"""Writes the sheet for typing in the chat: standing as he rests, head down,
both hands up in front of him, tapping.

Usage: python3 gen_type.py <out.json>

It is the rest pose with the arms and the head changed, so it is built on the
traced rest sheet (poses/idle.json): feet, sway and breathing are that sheet's,
frame for frame, and going from one to the other does not shift him. A loop of
the same sixteen frames.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Taps per loop, each hand. The two alternate, as on a keyboard.
TAPS = 4

with open(os.path.join(HERE, "poses", "idle.json")) as fh:
    rest = json.load(fh)["frames"]

frames = []
for i, base in enumerate(rest):
    beat = 2 * math.pi * TAPS * i / len(rest)
    right, left = math.sin(beat), math.sin(beat + math.pi)
    # He glances up from the keys once a loop: staring down the whole time
    # reads as a statue with moving hands.
    glance = math.sin(math.pi * i / len(rest)) ** 6
    pose = dict(base)
    pose.update({
        "chest": [7.0, 0.0, 0.0],
        "head": [24.0 - 16.0 * glance, 0.0, 0.0],
        "arm_r": [38.0 + 3.0 * right, 4.0, 0.0],
        "arm_l": [44.0 + 3.0 * left, -3.0, 0.0],
        "arm_r_bend": [58.0 + 11.0 * max(0.0, right), 0.0, 0.0],
        "arm_l_bend": [54.0 + 11.0 * max(0.0, left), 0.0, 0.0],
    })
    frames.append(pose)

json.dump({"frames": frames}, open(sys.argv[1], "w"), indent=1)
