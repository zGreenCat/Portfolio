"""Writes the sheets for typing in the chat: head down, both hands up in front
of him, tapping. One per posture he can be in when a `/tp` is typed.

Usage: python3 gen_type.py <out.json> [stand|sit|podium]

- `stand` (default): the rest pose with the arms and the head changed, so it
  is built on the traced rest sheet (poses/idle.json): feet, sway and
  breathing are that sheet's, frame for frame, and going from one to the other
  does not shift him.
- `sit`: on the cliff edge. Built on the last frame of the sit sheet, so the
  body does not move when he starts typing; only arms and head do.
- `podium`: on the first place, facing the viewer with the medal on. Built on
  the cheer sheet's stance, without the hop.

All three are a loop of the same sixteen frames and share the tapping, so the
page plays them with one animation.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = 16
# Taps per loop, each hand. The two alternate, as on a keyboard.
TAPS = 4


def generated(script, *args):
    """The poses another generator writes, read back."""
    with tempfile.TemporaryDirectory() as work:
        out = os.path.join(work, "poses.json")
        subprocess.run([sys.executable, os.path.join(HERE, script), *args, out], check=True,
                       stdout=subprocess.DEVNULL)
        with open(out) as fh:
            data = json.load(fh)
    return data["frames"] if isinstance(data, dict) else data


def hands(i):
    """How far each hand is into its tap, and the glance up from the keys."""
    beat = 2 * math.pi * TAPS * i / FRAMES
    # He glances up once a loop: staring down the whole time reads as a statue
    # with moving hands.
    glance = math.sin(math.pi * i / FRAMES) ** 6
    return math.sin(beat), math.sin(beat + math.pi), glance


def typing(base, i, head, chest):
    right, left, glance = hands(i)
    pose = dict(base)
    pose.update({
        "chest": [chest, 0.0, 0.0],
        "head": [head - 16.0 * glance, 0.0, 0.0],
        "arm_r": [38.0 + 3.0 * right, 4.0, 0.0],
        "arm_l": [44.0 + 3.0 * left, -3.0, 0.0],
        "arm_r_bend": [58.0 + 11.0 * max(0.0, right), 0.0, 0.0],
        "arm_l_bend": [54.0 + 11.0 * max(0.0, left), 0.0, 0.0],
    })
    return pose


def stand():
    with open(os.path.join(HERE, "poses", "idle.json")) as fh:
        rest = json.load(fh)["frames"]
    if len(rest) != FRAMES:
        raise SystemExit(f"gen_type: poses/idle.json has {len(rest)} frames, expected {FRAMES}")
    return [typing(base, i, head=24.0, chest=7.0) for i, base in enumerate(rest)]


def sit():
    seated = generated("gen_sit.py")[-1]
    # Seated he leans back a little and looks at the horizon; to type he
    # brings the head down, but the torso stays where the sit sheet left it.
    seated.pop("head_yaw", None)
    return [typing(seated, i, head=20.0, chest=6.0) for i in range(FRAMES)]


def podium():
    stance = generated("gen_podium.py", "cheer")[0]
    # The cheer stance without the hop or the sway: he stops celebrating to
    # type. Still facing the viewer, still with the medal.
    stance.update({"x": 0.0, "z": 0.0})
    return [typing(stance, i, head=22.0, chest=5.0) for i in range(FRAMES)]


MODES = {"stand": stand, "sit": sit, "podium": podium}

if __name__ == "__main__":
    mode = sys.argv[2] if len(sys.argv) > 2 else "stand"
    if mode not in MODES:
        raise SystemExit(f"gen_type: unknown posture {mode!r}; use one of {', '.join(MODES)}")
    json.dump({"frames": MODES[mode]()}, open(sys.argv[1], "w"), indent=1)
