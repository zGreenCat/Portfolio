"""Writes the reworked throw: the hand-made one, with the trunk put to work.

Usage: python3 gen_throw.py <out.json>

The feet, the step back and forward and the timing come from the original
sheet, as traced into poses/throw.json. What changes is what that sheet lacks
next to `run`: the trunk loads and folds, the shoulders turn, the arm speeds up
all the way to the release instead of waiting and then jumping, and it follows
through afterwards.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = 19
# The page lets go once the gesture is 15/19 of the way through: frame index 15.
RELEASE = 15


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def keys(i, points):
    if i <= points[0][0]:
        return points[0][1]
    for (ia, va), (ib, vb) in zip(points, points[1:]):
        if i <= ib:
            return va + (vb - va) * smooth((i - ia) / (ib - ia))
    return points[-1][1]


def ramp(i, points):
    """Straight between keys: for the arm, whose speed the keys already shape."""
    if i <= points[0][0]:
        return points[0][1]
    for (ia, va), (ib, vb) in zip(points, points[1:]):
        if i <= ib:
            return va + (vb - va) * (i - ia) / (ib - ia)
    return points[-1][1]


# Where the near arm points in the picture, from hanging (0) back and up over
# the top (-180) to level in front (-270) and round to hanging again (-360).
# Each step is a little longer than the last until the release.
ARM = [(0, 0), (2, -20), (4, -44), (6, -72), (8, -104), (10, -142), (12, -186),
       (13, -212), (14, -241), (RELEASE, -272), (16, -312), (17, -343), (18, -360)]

with open(os.path.join(HERE, "poses", "throw.json")) as fh:
    traced = json.load(fh)["frames"]
drift = traced[0]["x"]

frames = []
for i, base in enumerate(traced):
    bend = keys(i, [(0, 0), (5, -8), (10, -15), (13, -2), (RELEASE, 21), (16, 17), (18, 0)])
    lean = keys(i, [(0, 0), (10, -3), (RELEASE, 6), (18, 0)])
    turn = keys(i, [(0, 0), (6, -22), (10, -32), (13, -6), (RELEASE, 22), (16, 16), (18, 0)])
    folded = bend + lean
    frames.append({
        "x": round(base["x"] - drift, 3),
        "z": base["z"],
        "leg_r": base["leg_r"], "leg_r_bend": base["leg_r_bend"],
        "leg_l": base["leg_l"], "leg_l_bend": base["leg_l_bend"],
        "torso": [lean, 0, 0],
        "chest": [bend, 0, turn],
        # Level and in profile whatever the trunk does.
        "head": [-folded * 0.75, 0, -turn * 0.85],
        # The arm hangs from the chest, so the fold is taken back out of it.
        "arm_r": [ramp(i, ARM) + folded, 0, 0],
        "arm_r_bend": keys(i, [(0, 0), (4, 42), (10, 68), (13, 40), (RELEASE, 0), (18, 0)]),
        "arm_l": [keys(i, [(0, 5), (8, 30), (RELEASE, -22), (18, 5)]), 0, 0],
        "arm_l_bend": keys(i, [(0, 0), (8, 24), (RELEASE, 10), (18, 0)]),
    })

json.dump({"zoom": 1.0, "frames": frames, "probe": {"joint": "arm_r_bend", "point": [0, 0, -6]}},
          open(sys.argv[1], "w"), indent=1)
