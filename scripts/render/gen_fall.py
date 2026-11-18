"""Writes the sheet of the 404 page: he falls into the End, lands, and looks
around, lost.

Usage: python3 gen_fall.py <out.json>

Three stretches, one after the other, and the page plays them in that order:
`fall` is a loop, flailing, while the page drops him from above the screen;
`land` is the hit, a deep crouch that he gets up from; `look` is a loop, on
his feet, turning his head one way and the other. `land` ends and `look`
starts and ends on the first pose of the traced rest sheet (poses/idle.json).

Drawn in place: the fall itself is the page's. He is turned toward the
viewer the whole time, three quarters; nothing here walks.

SEGMENTS is also in src/components/lostSheet.ts and they have to match:
tests/lost-sheet.test.mjs checks it.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SEGMENTS = {"fall": 6, "land": 8, "look": 16}
TURN = -68.0


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def first(value):
    return value[0] if isinstance(value, list) else value


with open(os.path.join(HERE, "poses", "idle.json")) as fh:
    rest = json.load(fh)["frames"][0]


def standing(crouch=0.0):
    """The rest pose, folded by `crouch` (0 standing, 1 as low as he goes)."""
    pose = dict(rest)
    for leg in ("leg_r", "leg_l"):
        pose[leg] = [first(rest.get(leg, 0)) - 34.0 * crouch, 0.0, 0.0]
        pose[leg + "_bend"] = [first(rest.get(leg + "_bend", 0)) + 72.0 * crouch, 0.0, 0.0]
    pose["z"] = rest.get("z", 0) - 2.3 * crouch
    pose["root"] = [0.0, 0.0, TURN]
    return pose


frames = []

# Falling: arms up and out, legs pedalling, looking at what is coming.
for i in range(SEGMENTS["fall"]):
    wave = math.sin(2 * math.pi * i / SEGMENTS["fall"])
    other = math.cos(2 * math.pi * i / SEGMENTS["fall"])
    pose = dict(rest)
    pose.update({
        # Up and open, in a V. The spread is the side turn, not the twist:
        # with twist the raised arms folded over his head.
        "arm_r": [168.0 + 12.0 * wave, -24.0 - 8.0 * other, 0.0],
        "arm_l": [168.0 - 12.0 * wave, 24.0 - 8.0 * other, 0.0],
        "arm_r_bend": [6.0 + 8.0 * other, 0.0, 0.0],
        "arm_l_bend": [6.0 - 8.0 * other, 0.0, 0.0],
        "leg_r": [16.0 * wave, 0.0, 0.0],
        "leg_l": [-16.0 * wave, 0.0, 0.0],
        "leg_r_bend": [22.0 + 14.0 * wave, 0.0, 0.0],
        "leg_l_bend": [22.0 - 14.0 * wave, 0.0, 0.0],
        "root": [0.0, 5.0 + 2.0 * other, TURN],
        "chest": [-4.0, 0.0, 0.0],
        "head": [16.0, 0.0, 0.0],
        "eyes": 0.0,
    })
    frames.append(pose)

# Landing: the hit folds him, arms thrown down and forward, and he gets up.
FOLD = [1.0, 0.94, 0.8, 0.58, 0.34, 0.15, 0.04, 0.0]
for i, crouch in enumerate(FOLD):
    pose = standing(crouch)
    for arm in ("arm_r", "arm_l"):
        side = 1 if arm == "arm_r" else -1
        pose[arm] = [first(rest.get(arm, 0)) * (1 - crouch) + 38.0 * crouch, 0.0, side * 14.0 * crouch]
        pose[arm + "_bend"] = [26.0 * crouch, 0.0, 0.0]
    pose["chest"] = [first(rest.get("chest", 0)) + 16.0 * crouch, 0.0, 0.0]
    pose["head"] = [first(rest.get("head", 0)) + 20.0 * crouch, 0.0, 0.0]
    pose["blink"] = 1.0 if i < 2 else 0.0
    frames.append(pose)

# Lost: one way, the other, and a blink in between. No body moves, only the
# head and the eyes, and they lead: the eyes arrive before the head does.
for i in range(SEGMENTS["look"]):
    u = i / SEGMENTS["look"]
    yaw = 46.0 * math.sin(2 * math.pi * u)
    lead = math.sin(2 * math.pi * (u + 0.08))
    pose = standing()
    pose["head"] = [first(rest.get("head", 0)) - 4.0 * abs(math.sin(2 * math.pi * u)), 0.0, 0.0]
    pose["head_yaw"] = yaw
    pose["eyes"] = max(-1.0, min(1.0, 1.4 * lead))
    pose["blink"] = 1.0 if i == 8 else 0.0
    frames.append(pose)

assert len(frames) == sum(SEGMENTS.values())
json.dump({"frames": frames}, open(sys.argv[1], "w"), indent=1)
print(f"fall: {len(frames)} poses")
