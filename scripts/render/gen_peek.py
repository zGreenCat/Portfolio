"""Writes the shot and pose list for the greeting sheet: he rises from the
bottom edge of the screen facing the viewer, chest up, waves with both hands
and sinks back down.

Usage: python3 gen_peek.py <out.json> [scale]

The bottom edge of the cell is the bottom edge of the screen: it is what cuts
him, so the cell has to be anchored there. Nothing else touches an edge.

The rhythm comes from the hand-made greeting, traced with fit_pose.py: in by
frame 5, arms up between 10 and 13, one beat of the wave every ten frames.
That sheet peeked in from the left with one arm; facing front shows the whole
face and both hands without leaning the body out of the frame to fit them.
"""
import json
import math
import sys

FRAMES = 32
CELL = (640, 480)
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

# In frames, as the traced sheet has them.
IN, OUT = (0, 5), (28, 31)
ARMS_UP, ARMS_DOWN = (10, 13), (27, 30)
BEAT, FIRST_PEAK, SWING = 10.0, 15.5, 14.0
RAISED = 140.0
BELOW = -20.0
# The frame starts mid-chest: legs and hanging hands never show.
FLOOR = 14.5
PX_PER_UNIT = 19.0


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def span(i, a, b):
    return smooth((i - a) / (b - a))


frames = []
for i in range(FRAMES):
    shown = span(i, *IN) * (1 - span(i, *OUT))
    # He comes up a little too far and drops back, so he lands instead of stopping.
    bounce = math.sin(math.pi * span(i, 4, 10)) * 1.3
    arm_up = span(i, *ARMS_UP) * (1 - span(i, *ARMS_DOWN))
    phase = 2 * math.pi * (i - FIRST_PEAK) / BEAT
    wave = SWING * math.cos(phase) * arm_up
    # One hand trails the other a little; in perfect unison it reads as a machine.
    wave_r = SWING * math.cos(phase - 0.7) * arm_up
    sway = math.sin(phase) * arm_up
    # Elbows fold on the way up and down. Straight arms pass through level
    # there, and level they are wider than the cell.
    fold = 78 * math.sin(math.pi * arm_up)
    frames.append({
        "z": BELOW * (1 - shown) + bounce,
        "root": [2.5 * sway, 5 * shown, 0],
        "chest": [5 * shown, 2 * sway, 0],
        "head": [-3 * shown, 5 * sway, 0],
        "arm_l": [6 * arm_up, RAISED * arm_up + wave, 0],
        "arm_r": [6 * arm_up, -(RAISED * arm_up + wave_r), 0],
        "arm_l_bend": 14 * arm_up + fold,
        "arm_r_bend": 14 * arm_up + fold,
    })

tall = CELL[1] / PX_PER_UNIT
middle = FLOOR + tall / 2
distance = 70.0
json.dump({
    "camera": {
        "type": "PERSP",
        "fov": math.degrees(2 * math.atan(tall / 2 / distance)),
        "resolution": [round(CELL[0] * SCALE), round(CELL[1] * SCALE)],
        "location": [distance, 0.0, middle],
        "target": [0, 0.0, middle],
    },
    "light": {"dir": [0.85, -0.3, 0.45], "full": 0.8, "depth": 0.24},
    "frames": frames,
}, open(sys.argv[1], "w"), indent=1)
