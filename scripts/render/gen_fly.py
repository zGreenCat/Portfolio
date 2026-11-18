"""Writes the sheet for flying off with the elytra: he raises a firework
rocket, crouches, the wings open, he lights it, jumps tipping forward, and
then glides.

Usage: python3 gen_fly.py <out.json>

Twenty frames. The first ten are the take-off, drawn in place: the page moves
him, as it does on the podium. The last ten are the glide, a loop.

It starts on the first pose of the traced rest sheet (poses/idle.json), so
going from standing to this does not shift him. In the air he turns a little
toward the viewer: seen in pure profile the wings are edge-on, two lines.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TAKE_OFF, GLIDE = 10, 10
# The frame on which the rocket goes off: from here it is no longer in his
# hand, and the page draws its sparks.
FIRE = 6
# The body in the air: tipped forward and turned toward the viewer.
PITCH, TURN = 58.0, -20.0


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def span(i, a, b):
    """0 before frame a, 1 from frame b, eased between."""
    return smooth((i - a) / (b - a))


def first(value):
    return value[0] if isinstance(value, list) else value


with open(os.path.join(HERE, "poses", "idle.json")) as fh:
    rest = json.load(fh)["frames"][0]

frames = []
for i in range(TAKE_OFF + GLIDE):
    crouch = span(i, 1, 4) * (1 - span(i, 5, 7))
    up = span(i, 5, 9)
    # The rocket hand comes up in front of him, and drops back once it fires.
    raise_ = span(i, 0, 3) * (1 - span(i, FIRE, 9))
    glide = (i - TAKE_OFF) / GLIDE if i >= TAKE_OFF else 0.0
    bob = math.sin(2 * math.pi * glide) if i >= TAKE_OFF else 0.0
    pose = dict(rest)

    def blend(name, standing, flying):
        return standing + (flying - standing) * up

    for leg, trail in (("leg_r", -6.0), ("leg_l", 5.0)):
        pose[leg] = [blend(leg, first(rest.get(leg, 0)), trail) - 30.0 * crouch, 0.0, 0.0]
        pose[leg + "_bend"] = [64.0 * crouch + blend(leg, first(rest.get(leg + "_bend", 0)), -6.0), 0.0, 0.0]
    for arm, back in (("arm_r", -14.0), ("arm_l", -10.0)):
        lift = raise_ if arm == "arm_r" else 0.0
        pose[arm] = [blend(arm, first(rest.get(arm, 0)), back) - 22.0 * crouch * (1 - lift) + 118.0 * lift, 0.0, 0.0]
        pose[arm + "_bend"] = [blend(arm, first(rest.get(arm + "_bend", 0)), 8.0) + 24.0 * lift, 0.0, 0.0]
    pose.update({
        "x": rest.get("x", 0) - 3.5 * up,
        "z": rest.get("z", 0) - 1.9 * crouch + (7.0 + 0.5 * bob) * up,
        "root": [0.0, (PITCH + 2.0 * bob) * up, TURN * up],
        "chest": [8.0 * crouch - 4.0 * up, 0.0, 0.0],
        # He looks where he is going, not at the ground.
        "head": [10.0 * crouch - 44.0 * up, 0.0, 0.0],
        "elytra": 1,
        "rocket": 1 if i < FIRE else 0,
        "wings": max(0.0, span(i, 2, 8) - 0.07 * (0.5 + 0.5 * bob) * (1 if i >= TAKE_OFF else 0)),
    })
    frames.append(pose)

json.dump({"frames": frames}, open(sys.argv[1], "w"), indent=1)
print(f"fly: {len(frames)} poses")
