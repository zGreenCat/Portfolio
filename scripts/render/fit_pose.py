"""Fits the rig to a frame of an existing sheet: moves the joints until the
render matches the picture.

Usage: blender -b -P fit_pose.py -- <skin.png> <targets_dir> <start.json> <out.json>

`targets_dir` holds the frames of one sheet as PNG cells, already moved into
the rig's own geometry, at any size that keeps the 460:600 shape; the fit runs
at that size. `start.json` is one pose to start the first frame from, and each
later frame starts from the one before it.

If `start.json` is a list with one pose per frame, each frame starts from its
own pose instead. With `FIT_ARMS_FLAT=1` only the arms move, and only in the
plane of the screen: pitch and elbow. Left free, the fit shortens an arm by
pointing it at the viewer, which matches the outline and is the wrong pose
for a gesture drawn in profile.

`FIT_ARM_SIDE_MAX=<degrees>` caps how far an arm may leave that plane without
pinning it, for sheets where the arms open a little. `FIT_NO_SWEEP=1` skips
the round-the-clock arm search: an arm that only swings by the body never
needs it, and the search can park it behind the trunk.

It is coordinate descent: each number is nudged both ways and kept when the
picture gets closer, with the nudge halving every round. The first frame also
fits `zoom`, because the sheets were not rendered at one scale; the rest of
the sheet keeps what it found.

What it cannot match is the useful output: a pose that stays far off after the
fit is something the rig cannot do yet.
"""
import json
import os
import sys
import tempfile
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:]
SKIN, TARGETS, START, OUT = ARGS[:4]
FOOT_Y = 540
FIRST_STEPS = (24, 24, 12, 12, 6, 6, 3, 3, 1.5)
NEXT_STEPS = (16, 8, 4, 2, 2)

# (joint, axis, unit): axis 0 pitch, 1 side, 2 twist. Position moves in skin
# pixels, a sixteenth of an angle step, or it would leap across the cell.
FREE = [("x", None, 1 / 16), ("z", None, 1 / 16)]
FREE += [(joint, axis, 1.0) for joint in ("torso", "chest", "head", "arm_r", "arm_l") for axis in (0, 1, 2)]
FREE += [(joint, 0, 1.0) for joint in ("arm_r_bend", "arm_l_bend", "leg_r", "leg_l", "leg_r_bend", "leg_l_bend")]
FREE += [("leg_r", 1, 0.5), ("leg_l", 1, 0.5)]
ARMS_FLAT = os.environ.get("FIT_ARMS_FLAT") == "1"
if ARMS_FLAT:
    FREE = [(joint, 0, 1.0) for joint in ("arm_r", "arm_r_bend", "arm_l", "arm_l_bend")]
ARM_SIDE_MAX = float(os.environ.get("FIT_ARM_SIDE_MAX", "720"))
SWEEP_ARMS = os.environ.get("FIT_NO_SWEEP") != "1"
LIMITS = {"arm_r_bend": (0, 150), "arm_l_bend": (0, 150), "leg_r_bend": (-150, 0), "leg_l_bend": (-150, 0)}


def pixels(path):
    image = bpy.data.images.load(path, check_existing=False)
    width, height = image.size
    data = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(data)
    bpy.data.images.remove(image)
    return data.reshape(height, width, 4)


def normalise(pose):
    out = {}
    for key, value in pose.items():
        out[key] = float(value) if key in ("x", "y", "z", "head_yaw", "zoom") else list(value) if isinstance(value, list) else [float(value), 0.0, 0.0]
    for joint, axis, _ in FREE:
        if axis is None:
            out.setdefault(joint, 0.0)
        else:
            out.setdefault(joint, [0.0, 0.0, 0.0])
    return out


def get(pose, joint, axis):
    return pose[joint] if axis is None else pose[joint][axis]


def put(pose, joint, axis, value):
    if axis is None:
        pose[joint] = value
        return
    low, high = LIMITS.get(joint, (-720, 720))
    if axis == 1 and joint in ("arm_r", "arm_l"):
        value = max(-ARM_SIDE_MAX, min(ARM_SIDE_MAX, value))
    pose[joint][axis] = max(low, min(high, value)) if axis == 0 else value


paths = sorted(os.path.join(TARGETS, name) for name in os.listdir(TARGETS) if name.endswith(".png"))
height, width = pixels(paths[0]).shape[:2]
shot = rig.world_camera(FOOT_Y)
shot["resolution"] = (width, height)
scene = rig.setup_scene(shot)
scene.eevee.taa_render_samples = 4
joints = rig.build(rig.make_material(bpy.data.images.load(SKIN), rig.WORLD_LIGHT))
scratch = os.path.join(tempfile.mkdtemp(dir="/dev/shm" if os.path.isdir("/dev/shm") else None), "fit.png")
scene.render.filepath = scratch
renders = 0


def cost(pose, target, target_rgb):
    global renders
    scene.camera.data.ortho_scale = shot["ortho_scale"] / pose["zoom"]
    rig.apply(joints, pose)
    bpy.ops.render.render(write_still=True)
    renders += 1
    got = pixels(scratch)
    shape = np.abs(got[..., 3] - target[..., 3]).mean()
    colour = np.abs(got[..., :3] * got[..., 3:] - target_rgb).mean()
    return float(shape + colour)


# An arm can travel half a turn between two frames of a throw. Nudging from the
# last pose never finds it again: it settles hidden against the body, which
# costs little because arm and trunk are both dark. So each frame first tries
# the arms all the way round, folded and straight, and keeps the best.
SWEEP = [(pitch, bend) for pitch in range(-330, 31, 30) for bend in (0, 45, 90)]


def sweep_arms(pose, target, target_rgb, best):
    for arm in ("arm_r", "arm_l"):
        keep = (pose[arm][0], pose[arm + "_bend"][0])
        for pitch, bend in SWEEP:
            pose[arm][0], pose[arm + "_bend"][0] = float(pitch), float(bend)
            trial = cost(pose, target, target_rgb)
            if trial < best - 1e-6:
                best, keep = trial, (float(pitch), float(bend))
        pose[arm][0], pose[arm + "_bend"][0] = keep
    return best


def fit(pose, path, steps, free):
    target = pixels(path)
    target_rgb = target[..., :3] * target[..., 3:]
    best = cost(pose, target, target_rgb)
    if SWEEP_ARMS:
        best = sweep_arms(pose, target, target_rgb, best)
    for step in steps:
        for joint, axis, unit in free:
            here = get(pose, joint, axis)
            for delta in (step * unit, -step * unit):
                put(pose, joint, axis, here + delta)
                trial = cost(pose, target, target_rgb)
                if trial < best - 1e-6:
                    best = trial
                    here = get(pose, joint, axis)
                    break
                put(pose, joint, axis, here)
    return best


with open(START) as fh:
    start = json.load(fh)
if isinstance(start, dict) and "frames" in start:
    zoom, start = start.get("zoom", 1.0), start["frames"]
    for one in start:
        one.setdefault("zoom", zoom)
per_frame = isinstance(start, list)
pose = normalise(start[0] if per_frame else start)
pose.setdefault("zoom", 1.0)
began = time.time()
out = []
for index, path in enumerate(paths):
    first = index == 0
    if per_frame:
        pose = normalise(start[index])
        pose.setdefault("zoom", 1.0)
    if ARMS_FLAT:
        for arm in ("arm_r", "arm_l"):
            pose[arm][1] = pose[arm][2] = 0.0
    steps = NEXT_STEPS if (per_frame or not first) else FIRST_STEPS
    free = FREE + ([("zoom", None, 1 / 400)] if first and not per_frame else [])
    best = fit(pose, path, steps, free)
    out.append({key: ([round(v, 2) for v in value] if isinstance(value, list) else round(value, 4)) for key, value in pose.items()})
    print(f"FIT {os.path.basename(path)} cost {best:.5f} zoom {pose['zoom']:.3f} renders {renders} {time.time() - began:.0f}s", flush=True)
    with open(OUT, "w") as fh:
        json.dump(out, fh, indent=1)
print(f"FIT done {len(out)} frames in {renders} renders")
