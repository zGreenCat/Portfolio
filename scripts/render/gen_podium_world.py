"""Writes the three layers of the awards place: a stage on a mountain flat,
with the winners' podium on it.

Usage: python3 gen_podium_world.py <out_dir>
       blender -b -P world.py -- <textures_dir> <out_dir>/podium_ground.json <png>

The podium follows the ones people build in the game: three separate columns of
different heights, each with a cap that overhangs, a band of its metal and a
coloured panel with its number. First place is gold, second iron, third copper.
Behind it a blue cloth hangs between two pillars, under a beam with a gold cup.

Layers: `podium_ground` (flat, stage and podium), `podium_mid` (spruces and
pennants), `podium_far` (two snowy ridges).
"""
import json, math, random, sys
OUT = sys.argv[1]
X0, X1 = -2, 32
DEPTH = 7

def pick(x, d, options):
    return options[(x * 31 + d * 17) % len(options)]

def save(name, blocks, plants, parts, depth, anchors=None):
    json.dump({"surface_row": 2791, "ground_depth": depth, "blocks": blocks, "plants": plants, "parts": parts,
               "anchors": anchors or {}}, open(f"{OUT}/{name}.json", "w"))
    print(name, len(blocks), "bloques", len(parts), "piezas", len(plants), "plantas")

FULL = [0, 0, 0, 1, 1, 1]
def box(parts, x, d, h, tex, x0=0, y0=0, z0=0, x1=1, y1=1, z1=1):
    parts.append([x, d, h, tex, [x0, y0, z0, x1, y1, z1]])

def stair(parts, x, d, h, tex, rising="right"):
    """Lower half full, upper half on the side the stair climbs toward."""
    box(parts, x, d, h, tex, z1=0.5)
    if rising == "right":
        box(parts, x, d, h, tex, x0=0.5, z0=0.5)
    else:
        box(parts, x, d, h, tex, x1=0.5, z0=0.5)

# ---------- suelo: explanada con el escenario ----------
random.seed(11)
b, p, parts = [], [], []
STAGE = (8, 21)   # columnas del estrado
for x in range(X0, X1):
    for d in range(DEPTH):
        on_stage = STAGE[0] - 1 <= x <= STAGE[1] + 1
        grassy = math.sin(x * 0.9 + d * 1.7) + math.sin(x * 0.37) > 0.4 and not on_stage
        b.append([x, d, 0, "grass_block" if grassy else pick(x, d, ["stone"] * 4 + ["gravel", "andesite"]) if not on_stage else "polished_andesite"])
        b += [[x, d, -1, "stone"], [x, d, -2, "stone"]]
        if grassy and random.random() < 0.35:
            p.append([x, d, 0, random.choice(["short_grass"] * 4 + ["dandelion", "poppy"])])

# estrado: media losa de cuarzo, con peldaño en cada extremo
for x in range(STAGE[0], STAGE[1] + 1):
    for d in range(1, 5):
        box(parts, x, d, 1, "quartz_bricks", z1=0.5)
for d in range(1, 5):
    box(parts, STAGE[0] - 1, d, 1, "quartz_block_side", x0=0.5, z1=0.25)
    box(parts, STAGE[1] + 1, d, 1, "quartz_block_side", x1=0.5, z1=0.25)
# alfombra roja, de punta a punta
for x in range(STAGE[0], STAGE[1] + 1):
    box(parts, x, 2, 1, "red_wool", z0=0.5, z1=0.5625)
    box(parts, x, 3, 1, "red_wool", z0=0.5, z1=0.5625)

# columnas: 2.o a la izquierda, 1.o en el centro y mas alto, 3.o a la derecha
DIGITS = {1: ["010", "110", "010", "010", "111"], 2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "111", "001", "111"]}
def column(x, tall, metal, cloth, place):
    base = 0.5
    for xx in (x, x + 1):
        for d in (2, 3):
            whole = int(tall)
            for unit in range(whole):
                box(parts, xx, d, 1 + unit, "quartz_pillar_side", z0=base, z1=base + 1)
            if tall > whole:
                box(parts, xx, d, 1 + whole, "quartz_pillar_side", z0=base, z1=base + tall - whole)
    top = base + tall
    # zocalo, banda de metal y tapa de madera que sobresale
    box(parts, x, 2, 1, "quartz_block_side", x0=-0.125, y0=-0.125, z0=base, x1=2.125, y1=2.125, z1=base + 0.25)
    box(parts, x, 2, 1, metal, x0=-0.06, y0=-0.06, z0=top - 0.25, x1=2.06, y1=2.06, z1=top)
    box(parts, x, 2, 1, "dark_oak_planks", x0=-0.25, y0=-0.25, z0=top, x1=2.25, y1=2.25, z1=top + 0.25)
    # franja de color al frente, con su placa y el numero
    box(parts, x, 2, 1, cloth, x0=0.5, y0=-0.04, z0=base + 0.25, x1=1.5, y1=0.0, z1=top - 0.25)
    plate = top - 1.05
    box(parts, x, 2, 1, "white_concrete", x0=0.56, y0=-0.07, z0=plate, x1=1.44, y1=-0.04, z1=plate + 0.74)
    cell = 0.12
    for row, line in enumerate(DIGITS[place]):
        for col, ch in enumerate(line):
            if ch == "1":
                box(parts, x, 2, 1, "black_wool", x0=0.82 + col * cell, y0=-0.1, z0=plate + 0.07 + (4 - row) * cell, x1=0.82 + (col + 1) * cell, y1=-0.07, z1=plate + 0.07 + (5 - row) * cell)
    return top + 0.25
column(11, 2, "iron_block", "light_gray_wool", 2)
TOP = column(14, 3, "gold_block", "yellow_wool", 1)
column(17, 1.5, "copper_block", "orange_wool", 3)
print("alto del primer puesto sobre el suelo:", TOP)

# telon de fondo: dos columnas, viga, un pano azul con ribete y la copa
for x in (9, 20):
    for h in range(1, 8):
        b.append([x, 5, h, "quartz_pillar"])
    b.append([x, 5, 8, "glowstone"])
for x in range(9, 21):
    box(parts, x, 5, 8, "stripped_spruce_log", y0=0.25, y1=0.75, z0=0.25, z1=0.75)
for x in range(10, 20):
    for unit in range(6):
        box(parts, x, 5, 2 + unit, "blue_wool", y0=0.45, y1=0.55, z0=0.25, z1=1.25)
    box(parts, x, 5, 2, "yellow_wool", y0=0.43, y1=0.57, z0=0.0, z1=0.25)
cup = ["  ###  ", "# ### #", "#######", " ##### ", "  ###  ", "   #   ", "  ###  "]
for row, line in enumerate(cup):
    for col, ch in enumerate(line):
        if ch == "#":
            box(parts, 14, 5, 9, "gold_block", x0=-0.75 + col * 0.5, y0=0.25, z0=(len(cup) - 1 - row) * 0.5, x1=-0.25 + col * 0.5, y1=0.75, z1=(len(cup) - row) * 0.5)
# postes con cuerda a los lados
for x in (8, 10, 19, 21):
    box(parts, x, 1, 1, "dark_oak_planks", x0=0.4, y0=0.4, z0=0.5, x1=0.6, y1=0.6, z1=1.5)
    box(parts, x, 1, 1, "gold_block", x0=0.35, y0=0.35, z0=1.5, x1=0.65, y1=0.65, z1=1.65)
for x0, x1 in ((8, 10), (19, 21)):
    box(parts, x0, 1, 1, "red_wool", x0=0.5, y0=0.46, z0=1.25, x1=(x1 - x0) + 0.5, y1=0.54, z1=1.33)
# antorchas de luz al pie
for x in (7, 22):
    b.append([x, 5, 1, "polished_andesite"])
    b.append([x, 5, 2, "glowstone"])
# Where he stands: on the carpet to the left, then on second place, then on first.
save("podium_ground", b, p, parts, DEPTH, {"stage": [9.6, 3, 0.5625], "second": [12, 3, 2.75], "first": [15, 3, TOP]})

# ---------- medio: abetos y banderines ----------
b, p, parts = [], [], []
for x in range(X0, X1):
    for d in range(4):
        b.append([x, d, 0, "grass_block" if (x + d) % 3 else "stone"])
        b += [[x, d, -1, "stone"], [x, d, -2, "stone"]]
def spruce(x, d, trunk):
    for h in range(1, trunk + 1):
        b.append([x, d, h, "spruce_log"])
    for level, radius in enumerate([2, 1, 2, 1, 1, 0]):
        h = trunk - 2 + level
        for dx in range(-radius, radius + 1):
            for dd in range(-radius, radius + 1):
                if abs(dx) + abs(dd) <= radius + (1 if radius > 1 else 0) and (dx, dd) != (0, 0) or h > trunk:
                    b.append([x + dx, d + dd, h, "spruce_leaves"])
for x, trunk in ((2, 6), (6, 5), (24, 7), (28, 5)):
    spruce(x, 2, trunk)
for x, cloth in ((11, "red_wool"), (15, "yellow_wool"), (19, "light_blue_wool")):
    box(parts, x, 2, 1, "dark_oak_planks", x0=0.42, y0=0.42, z0=0, x1=0.58, y1=0.58, z1=7)
    box(parts, x, 2, 1, cloth, x0=0.58, y0=0.47, z0=5.4, x1=2.4, y1=0.53, z1=6.9)
save("podium_mid", b, p, parts, 4)

# ---------- fondo: dos cordilleras ----------
def ridge(x, peaks):
    return max(top - abs(x - cx) * slope for cx, top, slope in peaks)
b, p, parts = [], [], []
FRONT = [(3, 5.5, 0.8), (12, 4.0, 0.5), (21, 6.4, 0.9), (30, 4.6, 0.7)]
BACK = [(-1, 8.5, 0.7), (8, 11.6, 0.9), (17, 9.0, 0.8), (26, 12.6, 1.0)]
for x in range(X0, X1):
    for d in range(12):
        b.append([x, d, 0, "stone"])
        b += [[x, d, -1, "stone"], [x, d, -2, "stone"]]
    for d0, d1, peaks, snow_from in ((0, 5, FRONT, 6), (6, 12, BACK, 9)):
        top = ridge(x + 0.5, peaks)
        for d in range(d0, d1):
            edge = min(d - d0, d1 - 1 - d)
            lift = int(round(top - (1.2 if edge == 0 else 0.4 if edge == 1 else 0) + 0.6 * math.sin(x * 1.3 + d)))
            for h in range(1, max(1, lift) + 1):
                if h >= snow_from or (h == snow_from - 1 and (x + d) % 2):
                    name = "snow"
                elif (h + x // 3) % 5 == 0 and (x + d) % 3 == 0:
                    name = "calcite"
                else:
                    name = pick(x + h, d, ["stone"] * 7 + ["andesite", "tuff"])
                b.append([x, d, h, name])
save("podium_far", b, p, parts, 12)
