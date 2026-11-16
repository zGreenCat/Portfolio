"""Writes the shot and pose list for the sheet that keeps you company in the
image viewer: he rises beside the picture and looks up at it, and every so
often does something: turns to you and points at it with a nod, or wonders
about it with a hand on his chin.

Usage: python3 gen_watch.py <out.json> [scale]

It is the greeting's sibling and borrows its camera, its cell and the way it
comes up over the bottom edge (gen_peek.py). What changes is the body: three
quarters toward the picture, which hangs above him and to the right.

The sheet is four pieces in a row, and the page strings them together
(SEGMENTS, mirrored in Lightbox.tsx): the way in, played once; a short rest,
looking; and two gestures. Every gesture starts and ends on the first pose of
the rest, so any of them can follow any other, with as much rest in between as
the page likes. One long loop did both things back to back, forever, and read
as a tic.
"""
import json
import math
import sys

SEGMENTS = {"intro": 6, "rest": 12, "point": 22, "wonder": 24}
CELL = (640, 480)
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

BELOW = -20.0
# The frame starts mid-chest, as in the greeting: legs never show.
FLOOR = 14.5
PX_PER_UNIT = 19.0
# How far the body is turned toward the picture, and where the head goes to
# look at it: up and further round.
TURN = 30.0
LOOK = (-20.0, 24.0)
POINT = 118.0


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def window(u, rise_from, rise_to, fall_from, fall_to):
    """0 outside, 1 between rise_to and fall_from, eased at both ends."""
    return smooth((u - rise_from) / (rise_to - rise_from)) * (1 - smooth((u - fall_from) / (fall_to - fall_from)))


def beat(u, at, width):
    """One bump of 0..1..0 that starts at `at` and lasts `width`."""
    return math.sin(math.pi * smooth((u - at) / width)) if at <= u <= at + width else 0.0


def pose(shown=1.0, bounce=0.0, breath=0.0, at_you=0.0, pointing=0.0, nod=0.0, wondering=0.0, tap=0.0):
    looking = 1 - at_you
    return {
        "z": BELOW * (1 - shown) + bounce + 0.25 * breath,
        "root": [0, 4 * shown - 2 * wondering, TURN],
        "chest": [4 * shown + 2 * nod * at_you - 3 * wondering, 0, 6 * looking - 8 * at_you],
        # Wondering, the head tips to one side and looks a little higher.
        "head": [LOOK[0] * looking + 10 * nod * at_you - 4 * wondering + 3 * tap,
                 14 * wondering,
                 LOOK[1] * looking - TURN * 0.92 * at_you],
        # The arm on the picture's side goes up to point at it.
        "arm_l": [14 * pointing, (POINT + 7 * nod) * pointing + 4 * (1 - pointing), 0],
        "arm_l_bend": 10 * math.sin(math.pi * pointing) + 6 * pointing - 4 * nod * pointing,
        # The other one hangs, or comes up to the chin.
        "arm_r": [4 * breath * (1 - wondering) + 52 * wondering, -4 + 16 * wondering, 0],
        "arm_r_bend": 6 + (122 - 9 * tap) * wondering,
    }


frames = []
for i in range(SEGMENTS["intro"]):
    shown = smooth(i / (SEGMENTS["intro"] - 1))
    frames.append(pose(shown=shown, bounce=math.sin(math.pi * smooth((i - 2) / 5)) * 1.1))
for i in range(SEGMENTS["rest"]):
    frames.append(pose(breath=math.sin(2 * math.pi * i / SEGMENTS["rest"])))
for i in range(SEGMENTS["point"]):
    u = i / SEGMENTS["point"]
    frames.append(pose(
        breath=math.sin(4 * math.pi * u),
        at_you=window(u, 0.06, 0.26, 0.72, 0.94),
        pointing=window(u, 0.02, 0.26, 0.74, 1.0),
        # Two nods, the second smaller, each with a jab of the arm.
        nod=beat(u, 0.36, 0.14) + 0.6 * beat(u, 0.52, 0.12),
    ))
for i in range(SEGMENTS["wonder"]):
    u = i / SEGMENTS["wonder"]
    frames.append(pose(
        breath=math.sin(4 * math.pi * u),
        wondering=window(u, 0.02, 0.26, 0.74, 1.0),
        # The hand taps the chin twice while he thinks.
        tap=beat(u, 0.38, 0.12) + beat(u, 0.54, 0.12),
    ))

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
