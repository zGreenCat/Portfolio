"""Writes the pose list for the sit sheet: 31 frames, frame 1 standing."""
import json
import math
import sys

FRAMES = 31
LEG = 6.0
# The world stops 0.2% short of its end while he sits, so the cliff edge lands
# about 5 units ahead of where he stands. He scoots forward as he lowers so the
# shins hang past it instead of over the dirt.
HIP_STAND, HIP_SEAT = (0.0, 12.0), (2.0, 2.0)
T_DROP = (0.10, 0.62)
T_FEET = (0.36, 0.66)
SWING_DEG, SWING_DECAY, SWING_TURNS = 34.0, 4.0, 1.25


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def span(t, a, b):
    return smooth((t - a) / (b - a))


def keys(t, points):
    """Smoothstep between (time, value) keys."""
    if t <= points[0][0]:
        return points[0][1]
    for (ta, va), (tb, vb) in zip(points, points[1:]):
        if t <= tb:
            return va + (vb - va) * span(t, ta, tb)
    return points[-1][1]


def leg_ik(hip, foot):
    dx, dz = foot[0] - hip[0], foot[1] - hip[1]
    dist = min(math.hypot(dx, dz), 2 * LEG - 1e-4)
    toward = math.atan2(dx, -dz)
    fold = math.acos(dist / (2 * LEG))
    return math.degrees(toward + fold), math.degrees(-2 * fold)


def foot_at(t, hip, stand_x, lag, gain):
    t -= lag
    knee = (HIP_SEAT[0] + LEG, HIP_SEAT[1])
    def hang(deg):
        r = math.radians(deg)
        return (knee[0] + LEG * math.sin(r), knee[1] - LEG * math.cos(r))
    start, peak = (stand_x, 0.0), hang(SWING_DEG * gain)
    if t <= T_FEET[0]:
        return start
    if t <= T_FEET[1]:
        u = span(t, *T_FEET)
        ctrl = (peak[0] - 0.5, 0.6)
        return tuple((1 - u) ** 2 * start[i] + 2 * u * (1 - u) * ctrl[i] + u * u * peak[i] for i in range(2))
    tau = (t - T_FEET[1]) / (1 - T_FEET[1] - lag)
    swing = SWING_DEG * gain * math.exp(-SWING_DECAY * tau) * math.cos(2 * math.pi * SWING_TURNS * tau)
    return hang(swing)


frames = []
for i in range(FRAMES):
    t = i / (FRAMES - 1)
    drop = span(t, *T_DROP)
    hip = (HIP_STAND[0] + (HIP_SEAT[0] - HIP_STAND[0]) * smooth(drop ** 0.8),
           HIP_STAND[1] + (HIP_SEAT[1] - HIP_STAND[1]) * drop)
    torso = keys(t, [(0, 0), (0.12, 5), (0.40, 24), (0.66, -9), (0.82, -3), (1, -5)])
    pose = {
        "x": hip[0], "z": hip[1] - 12,
        "torso": torso,
        # Looks at the spot while going down, at the viewer on landing, then up at the sky.
        "head": -torso * 0.85 + keys(t, [(0.12, 0), (0.42, 14), (0.66, 4), (0.95, -24), (1, -24)]),
        "head_yaw": keys(t, [(0.12, 0), (0.42, 24), (0.60, 38), (0.70, 38), (0.95, 0), (1, 0)]),
        "arm_r": keys(t, [(0, -5), (0.14, 10), (0.50, -30), (0.70, -18), (1, -22)]),
        "arm_l": keys(t, [(0, 5), (0.16, 14), (0.54, -38), (0.74, -26), (1, -31)]),
    }
    for name, stand_x, lag, gain in (("leg_r", -1.25, 0.0, 1.0), ("leg_l", 1.25, 0.035, 0.8)):
        pose[name], pose[name + "_bend"] = leg_ik(hip, foot_at(t, hip, stand_x, lag, gain))
    frames.append(pose)

json.dump(frames, open(sys.argv[1], "w"), indent=1)
