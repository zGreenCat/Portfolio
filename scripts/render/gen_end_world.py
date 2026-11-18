"""Writes the place a wrong address lands on: an island of the End.

Usage: python3 gen_end_world.py <out_dir>
       blender -b -P world.py -- <textures_dir> <out_dir>/end_island.json <png>

The 404 page is the End: the place past the edge of the map. `end_island` is
where the character falls, an island of end stone hanging in the void, thick in
the middle and ragged underneath like the ones the game generates, with two
obsidian pillars and some chorus plants. `end_far` is the small islands in the
distance; the page shows them smaller and dimmer, behind.

Both are one picture each, anchored, not strips: nothing here scrolls.
"""
import json, math, random, sys
OUT = sys.argv[1]
SURFACE = 1900
# End stone is one pale texture: lit flat, the island was a cut-out.
SHADE = 0.05


def save(name, blocks, parts, depth, anchors=None):
    json.dump({"surface_row": SURFACE, "ground_depth": depth, "depth_shade": SHADE, "blocks": blocks, "plants": [], "parts": parts,
               "anchors": anchors or {}}, open(f"{OUT}/{name}.json", "w"))
    print(name, len(blocks), "bloques", len(parts), "piezas")


def box(parts, x, d, h, tex, x0=0, y0=0, z0=0, x1=1, y1=1, z1=1):
    parts.append([x, d, h, tex, [x0, y0, z0, x1, y1, z1]])


def island(blocks, cx, cd, rx, rd, thick, seed, stone="end_stone"):
    """An oval slab, thickest at the centre, with a ragged underside."""
    rng = random.Random(seed)
    for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
        for d in range(int(cd - rd) - 1, int(cd + rd) + 2):
            if d < 0:
                continue
            r = math.hypot((x + 0.5 - cx) / rx, (d + 0.5 - cd) / rd)
            r += 0.07 * math.sin(x * 1.9 + d * 0.7) + 0.05 * math.sin(d * 2.3 - x * 0.4)
            r = max(r, 0.0)
            if r > 1:
                continue
            down = 1 + thick * (1 - r ** 1.6) + rng.choice([0, 0, 0, 1, 1, 2]) * (1 - r)
            # Hanging tips, as under the islands of the game.
            if rng.random() < 0.08 and r < 0.75:
                down += rng.randint(1, 3)
            for h in range(0, -int(round(down)), -1):
                blocks.append([x, d, h, stone])
            # The top is not a table: it swells toward the back, away from
            # where he lands, so the edge of the island has a skyline.
            swell = 2.2 * math.sin(x * 0.55 + 1.0) + 1.2 * math.sin(x * 1.3 + d) + 0.3
            if d >= cd - 1 and r < 0.9 and x > cx + 1:
                for h in range(1, int(round(max(0.0, swell) * (1 - r))) + 1):
                    blocks.append([x, d, h, stone])


def chorus(parts, x, d, rng, tall):
    """A chorus plant: a thin stem that forks, a flower on each tip."""
    def stem(px, pd, h, height, forks):
        for unit in range(height):
            box(parts, px, pd, h + unit, "chorus_plant", x0=0.22, y0=0.22, x1=0.78, y1=0.78)
        top = h + height
        if forks == 0:
            box(parts, px, pd, top, "chorus_flower", x0=0.1, y0=0.1, z0=0, x1=0.9, y1=0.9, z1=0.8)
            return
        for side in rng.sample([-1, 1], rng.choice([1, 2, 2])):
            box(parts, px + (side if side < 0 else 0), pd, top, "chorus_plant",
                x0=0.22 if side > 0 else 0.22, y0=0.22, z0=0.22, x1=1.78 if side > 0 else 1.78, y1=0.78, z1=0.78)
            stem(px + side, pd, top, rng.randint(1, 3), forks - 1)
        box(parts, px, pd, top, "chorus_plant", x0=0.22, y0=0.22, x1=0.78, y1=0.78)
    stem(x, d, 1, tall, 2)


def pillar(blocks, x, d, tall):
    for dx in range(3):
        for dd in range(3):
            if (dx, dd) in ((0, 0), (2, 0), (0, 2), (2, 2)) and tall > 6:
                # Rounded: the corners stop one short.
                top = tall - 1
            else:
                top = tall
            for h in range(1, top + 1):
                blocks.append([x + dx, d + dd, h, "obsidian"])
    # The cage is gone, the bedrock stays: where the crystal sat.
    blocks.append([x + 1, d + 1, tall + 1, "bedrock"])


# ---------- la isla donde cae ----------
# Small on purpose: fifteen blocks, so that the whole of it fits on a screen
# with void all around. Twice as wide it filled the bottom of the page edge
# to edge and read as ground, not as an island. He lands on the bare left
# half; what stands up is on the right, clear of him and of the text above.
rng = random.Random(4)
b, parts = [], []
DEPTH = 8
island(b, 10.0, 4.0, 7.6, 4.0, 5.0, seed=7)
pillar(b, 13, 4, 6)
chorus(parts, 4, 5, rng, 2)
chorus(parts, 16, 3, rng, 1)
for x, d, h in ((9, 6, 1), (10, 6, 1), (10, 6, 2)):
    b.append([x, d, h, "end_stone_bricks"])
save("end_island", b, parts, DEPTH, {"land": [7.5, 2, 0]})

# ---------- las islas del fondo ----------
rng = random.Random(9)
b, parts = [], []
island(b, 5, 3, 4.2, 2.6, 3, seed=21)
island(b, 15, 4, 2.4, 2.0, 2, seed=22)
island(b, 24, 3, 3.6, 2.4, 3.5, seed=23)
chorus(parts, 4, 3, rng, 3)
chorus(parts, 25, 3, rng, 2)
for h in range(1, 8):
    for dx in range(2):
        b.append([22 + dx, 3, h, "obsidian"])
save("end_far", b, parts, 6)
