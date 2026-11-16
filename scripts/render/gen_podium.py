"""Writes the two sheets of the awards place.

Usage: python3 gen_podium.py <climb|cheer> <out.json>

`climb` is a one-off: he crouches, hops up to second place, hops again to
first, lands, turns to face the viewer and throws his arms up. It holds no
travel of its own. The hops are drawn in place and the page carries him along
each arc, the way it carries everything else, so the same sheet serves columns
of any height. `HOPS` says which frames are in the air.

One long leap straight to the top read as weightless. Two short ones, each
with its own crouch and landing, read as climbing.

`cheer` loops from where `climb` ends: facing the viewer, arms up, hopping.

There is no hand-made sheet to trace for either, so the poses lean on what the
traced ones taught: the whole trunk takes part, the arms open away from the
body, the head stays level. The medal is on from the landing; edge-on it is a
sliver, and it comes into view as he turns.
"""
import json
import math
import sys

LEG = 6.0
FEET = (-1.25, 1.25)
HOPS = ((4, 10), (13, 19))
LANDED = 20


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


def leg_ik(hip, foot):
    dx, dz = foot[0] - hip[0], foot[1] - hip[1]
    dist = min(math.hypot(dx, dz), 2 * LEG - 1e-4)
    toward = math.atan2(dx, -dz)
    fold = math.acos(dist / (2 * LEG))
    return math.degrees(toward + fold), math.degrees(-2 * fold)


def legs(pose, hip, foot_r, foot_l):
    pose["x"], pose["z"] = hip[0], hip[1] - 12
    pose["leg_r"], pose["leg_r_bend"] = leg_ik(hip, foot_r)
    pose["leg_l"], pose["leg_l_bend"] = leg_ik(hip, foot_l)
    return pose


def airborne(i):
    """0 on the ground; in a hop, how far through it he is, from just over 0 to 1."""
    for start, end in HOPS:
        if start < i < end:
            return (i - start) / (end - start)
    return 0.0


def climb(frames=32):
    out = []
    for i in range(frames):
        flight = airborne(i)
        in_air = 1.0 if flight else 0.0
        squat = keys(i, [(0, 0), (3, 1), (4, 0.35), (5, 0), (9, 0), (11, 1), (13, 0.3), (14, 0), (18, 0),
                         (LANDED, 1), (24, 0.1), (31, 0)])
        # Knees come up at the top of the hop and the legs reach down again to land.
        tuck = 2.9 * math.sin(math.pi * flight) ** 0.8 if flight else 0.0
        reach = 1.6 * max(0.0, flight - 0.55) if flight else 0.0
        hip = (keys(i, [(0, 0), (3, -0.9), (5, 0.5), (10, 0.2), (11, -0.6), (14, 0.5), (19, 0.2), (LANDED, -0.5), (25, 0)]),
               12 - 2.5 * squat)
        lean = keys(i, [(0, 0), (3, 23), (5, 9), (7, 13), (10, 5), (11, 25), (13, 11), (16, 13), (19, 5),
                        (LANDED, 24), (24, 6), (31, 0)])
        fold = keys(i, [(0, 0), (3, 9), (5, -5), (10, 0), (11, 10), (14, -5), (19, 0), (LANDED, 11), (25, 0), (31, -3)])
        turn = keys(i, [(22, 0), (27, 1)])
        # Arms go back in the crouch, are thrown up to take off and come down in
        # front by the landing. Held overhead the whole way, he hung in the air.
        swing = keys(i, [(0, -5), (3, -62), (5, 112), (7, 64), (10, 22), (11, -52), (14, 112), (16, 64), (19, 22),
                         (LANDED, 42), (24, 8), (27, 0)])
        up = keys(i, [(27, 0), (31, 1)])
        elbow = keys(i, [(0, 0), (3, 34), (5, 14), (10, 30), (11, 38), (14, 14), (19, 30), (LANDED, 48), (25, 10), (31, 12)])
        out.append(legs({
            "root": [0, 0, -90 * turn],
            "torso": lean,
            "chest": fold,
            "head": [-(lean + fold) * 0.8 - 5 * up, 0, 0],
            "arm_r": [swing, -150 * up - 12 * in_air, 0],
            "arm_l": [swing + 12 * (1 - up), 150 * up + 12 * in_air, 0],
            "arm_r_bend": elbow,
            "arm_l_bend": elbow,
            "medal": 1 if i >= LANDED else 0,
        }, hip, (FEET[0] + 0.6 * in_air + reach, tuck), (FEET[1] + 1.1 * in_air + reach, tuck * 1.3)))
    return out


def cheer(frames=16):
    out = []
    for i in range(frames):
        beat = 2 * math.pi * i / (frames / 2)
        hop = max(0.0, math.sin(beat))
        dip = max(0.0, -math.sin(beat))
        hip = (0.0, 12 + 1.5 * hop - 0.9 * dip)
        pump = 16 * math.sin(beat + 0.5)
        sway = math.sin(2 * math.pi * i / frames)
        out.append(legs({
            "root": [2 * sway, 0, -90],
            "chest": [-4, 2 * sway, 0],
            "head": [-6, 5 * sway, 0],
            "arm_r": [4, -(150 + pump), 0],
            "arm_l": [4, 150 + pump, 0],
            "arm_r_bend": 14 + 8 * dip,
            "arm_l_bend": 14 + 8 * dip,
            "medal": 1,
        }, hip, (FEET[0], 1.1 * hop), (FEET[1], 1.1 * hop)))
    return out


if __name__ == "__main__":
    json.dump({"climb": climb, "cheer": cheer}[sys.argv[1]](), open(sys.argv[2], "w"), indent=1)
