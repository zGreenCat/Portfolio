"""Writes the shot and pose list for the greeting sheet: he leans in from the
left edge of the screen with his body level, waves with both hands and leans
back out. Only the left edge cuts him, so the cell can sit at any height.

Usage: python3 gen_peek.py <out.json> [scale]
"""
import json
import math
import sys

FRAMES = 32
CELL = (435, 600)
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

LEAN = -80.0
# He comes out level and curls up toward the viewer: the waist takes part of
# the bend and the neck the rest, instead of the whole body tilting as a plank.
WAIST, NECK = 24.0, 18.0
TURN = 8.0
REST_Y, AWAY_Y = -11.2, -36.0
REST_Z = 2.5
T_IN, T_OUT = (0.0, 0.20), (0.86, 1.0)
# The arms go up while he is still sliding in and come down once he is leaving:
# raised from rest, the near one sweeps past the right edge of the cell.
T_ARM, T_ARM_DOWN = (0.04, 0.24), (0.88, 1.0)
WAVES = 2.5


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def span(t, a, b):
    return smooth((t - a) / (b - a))


frames = []
for i in range(FRAMES):
    t = i / (FRAMES - 1)
    shown = span(t, *T_IN) * (1 - span(t, *T_OUT))
    # A little past the rest pose on the way in, so he settles instead of stopping.
    settle = math.sin(math.pi * span(t, 0.12, 0.34)) * 1.0
    arm_up = span(t, *T_ARM) * (1 - span(t, *T_ARM_DOWN))
    beat = max(0.0, min(1.0, (t - T_ARM[1]) / (T_OUT[0] - T_ARM[1])))
    wave = math.sin(2 * math.pi * WAVES * beat) * 19 * arm_up
    # The far hand trails the near one a little; in perfect unison it reads as a machine.
    wave_r = math.sin(2 * math.pi * WAVES * beat - 0.7) * 19 * arm_up
    frames.append({
        "y": AWAY_Y + (REST_Y - AWAY_Y) * shown + settle,
        "z": REST_Z,
        "root": [LEAN, 0, TURN],
        # Tilted back toward upright: level with the body, the face reads as lying down.
        "chest": [0, WAIST * shown + wave * 0.1, 0],
        "head": [-4, NECK * shown + wave * 0.15, -TURN * 0.6],
        "arm_l": [10, 122 * arm_up + wave, 0],
        "arm_r": [10, -(122 * arm_up + wave_r), 0],
    })

json.dump({
    "camera": {
        "type": "PERSP",
        "fov": 30,
        "resolution": [round(CELL[0] * SCALE), round(CELL[1] * SCALE)],
        "location": [76, 0.0, 18.0],
        "target": [0, 0.0, 16.0],
    },
    "light": {"dir": [0.9, -0.25, 0.35], "full": 0.75, "depth": 0.26},
    "frames": frames,
}, open(sys.argv[1], "w"), indent=1)
