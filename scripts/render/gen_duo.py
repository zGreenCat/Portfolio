"""Writes the poses for the cover: him at three quarters, arms crossed, the way
he stands in the photo next to him.

Usage: python3 gen_duo.py <out.json>

Seven frames and no motion: five gazes, from far left to far right, and two of
a blink (half shut and shut). The page picks the frame from where the pointer
is and blinks on its own timer.

The arms are the composed rotation written down in the memory of the rig:
shoulder forward first, then inward, then the elbow. Any other order sweeps
the forearm through the chest.
"""
import json
import math
import sys

GAZES = (-1.0, -0.5, 0.0, 0.5, 1.0)
BLINKS = (0.55, 1.0)

# Skin units: the figure is 32 tall and the cell leaves air above the hair.
TALL, FLOOR, DISTANCE = 30.0, 4.5, 140.0
MIDDLE = FLOOR + TALL / 2

BASE = {
    "z": 0,
    "root": [0, 2, 58],
    "chest": [2, 0, -6],
    "head": [-2, 5, -50],
    "arm_r": [5.94, -47.72, 84.63],
    "arm_l": [5.13, 39.72, -83.86],
    "arm_r_bend": 86,
    "arm_l_bend": 86,
}

frames = [dict(BASE, eyes=gaze, blink=0) for gaze in GAZES]
frames += [dict(BASE, eyes=0, blink=shut) for shut in BLINKS]

sheet = {
    "camera": {
        "type": "PERSP",
        "fov": math.degrees(2 * math.atan(TALL / 2 / DISTANCE)),
        "resolution": [900, 1100],
        "location": [DISTANCE, 0.0, MIDDLE],
        "target": [0, 0.0, MIDDLE],
    },
    "light": {"dir": [0.85, -0.3, 0.45], "full": 0.8, "depth": 0.24},
    "frames": frames,
}

with open(sys.argv[1], "w") as fh:
    json.dump(sheet, fh)
print(f"duo: {len(frames)} poses")
