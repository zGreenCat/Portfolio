"""Minecraft-skin rig rendered headless.

Usage: blender -b -P rig.py -- <skin.png> <poses.json> <out_dir> [foot_y]

World units are skin pixels. The character faces +X and up is +Z.

A poses file that is a plain list uses the world camera: orthographic, looking
down +Y, so it sees the character's right side in pure profile. A file shaped
{"camera": ..., "light": ..., "frames": [...]} brings its own shot, which is
what the greeting needs: it is the one sheet that is not inside the world.
"""
import json
import math
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector


CELL_W, CELL_H = 460, 600
PX_PER_UNIT = 404 / 32.4
FOOT_Y = 548
CENTER_X = 232
TEX = 64
# `full` is the dot product at which a face reaches full value. In the world
# shot that is a face square to the camera, so profile sheets keep their tones.
WORLD_LIGHT = {"dir": (-0.45, -0.893, 0.0), "full": 0.893, "depth": 0.22}
# Mine-imator lights the skin slightly up and slightly blue: its white comes out
# (241, 242, 248) where the bare texture gives 229. Measured on `idle`, `walk`
# and `throw`, which agree with each other; as sRGB gains that is 1.05, 1.055
# and 1.08, applied here in linear light. Without it a sheet from this rig sits
# a shade darker than one from Mine-imator and the swap between them shows.
TINT = tuple(gain ** 2.2 for gain in (1.05, 1.055, 1.08))


def make_material(image, light):
    mat = bpy.data.materials.new("skin")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Closest"
    emit = nt.nodes.new("ShaderNodeEmission")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    # Faces square to the camera stay at full value; the rest darken a little so a
    # turned head still shows where the side ends and the face begins.
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = Vector(light["dir"]).normalized()
    ramp = nt.nodes.new("ShaderNodeMath")
    ramp.operation = "MULTIPLY_ADD"
    ramp.inputs[1].default_value = light["depth"] / light["full"]
    ramp.inputs[2].default_value = 1 - light["depth"]
    ramp.use_clamp = True
    shade = nt.nodes.new("ShaderNodeVectorMath")
    shade.operation = "SCALE"
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], ramp.inputs[0])
    tint = nt.nodes.new("ShaderNodeVectorMath")
    tint.operation = "MULTIPLY"
    tint.inputs[1].default_value = light.get("tint", TINT)
    nt.links.new(tex.outputs["Color"], tint.inputs[0])
    nt.links.new(tint.outputs["Vector"], shade.inputs[0])
    nt.links.new(ramp.outputs[0], shade.inputs["Scale"])
    nt.links.new(shade.outputs["Vector"], emit.inputs["Color"])
    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def box(name, parent, mat, lo, size, uv, whd, rows=None, inflate=0.0):
    """lo/size in (x=depth, y=width, z=height); uv is the skin origin of the
    part; whd its texture dims; rows the slice of side rows this box shows."""
    w, h, d = whd
    u, v = uv
    r0, r1 = rows or (0, h)
    x0, y0, z0 = (c - inflate for c in lo)
    x1, y1, z1 = (lo[i] + size[i] + inflate for i in range(3))
    side_v = (v + d + r0, v + d + r1)
    faces = [
        # verts listed top-left, top-right, bottom-right, bottom-left as seen from outside
        ([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], (u, u + d), side_v),
        ([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], (u + d, u + d + w), side_v),
        ([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], (u + d + w, u + 2 * d + w), side_v),
        ([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], (u + 2 * d + w, u + 2 * d + 2 * w), side_v),
        ([(x0, y0, z1), (x0, y1, z1), (x1, y1, z1), (x1, y0, z1)], (u + d, u + d + w), (v, v + d)),
        ([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], (u + d + w, u + d + 2 * w), (v, v + d)),
    ]
    verts, polys, uvs = [], [], []
    for quad, (ua, ub), (va, vb) in faces:
        base = len(verts)
        verts += quad
        polys.append(tuple(range(base, base + 4)))
        uvs += [(ua, va), (ub, va), (ub, vb), (ua, vb)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop, (tu, tv) in zip(layer.data, uvs):
        loop.uv = (tu / TEX, 1 - tv / TEX)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


# A joint is two boxes meeting at a pivot. Each one ends on the plane that
# bisects the bend, a mitre, so the outside of a knee stays a clean corner at
# any angle. Overlapping the halves instead left a spike wherever the bend was
# not a right angle.
#
# A mitre grows without bound as the bend closes, so it stops at a right angle.
# Past that, a round pin as wide as the limb fills the wedge that opens. Round
# because it cannot reach past either half at any angle; a square block did.
MITRES = []
MITRE_LIMIT = math.tan(math.radians(45))


def mitre(joint, obj, end, role):
    """Registers the end of a box that sits on `joint`. The pivot is at x=y=0."""
    zs = [v.co.z for v in obj.data.vertices]
    level = max(zs) if end == "top" else min(zs)
    ring = [(v.index, v.co.x, v.co.y, v.co.z) for v in obj.data.vertices if abs(v.co.z - level) < 1e-6]
    MITRES.append((joint, obj.data, ring, 1 if role == "parent" else -1))


def apply_mitres(j):
    for joint, mesh, ring, side in MITRES:
        about_x, about_y, _ = j[joint].rotation_euler
        slope_x = max(-MITRE_LIMIT, min(MITRE_LIMIT, math.tan(about_y / 2)))
        slope_y = max(-MITRE_LIMIT, min(MITRE_LIMIT, math.tan(about_x / 2)))
        for index, x, y, z in ring:
            mesh.vertices[index].co.z = z + side * (y * slope_y - x * slope_x)
        mesh.update()


# The trunk is one piece cut into slices, and the waist is spread over them:
# each slice takes a growing share of the chest's turn. Two rigid halves on a
# hinge showed a step wherever the chest twisted against the hips; one box that
# gives all the way up reads as a body.
TRUNKS = []
WAIST = (0, 0, 6)
WAIST_FROM, WAIST_TO = 1.5, 10.5


def trunk(name, parent, mat, uv, inflate=0.0):
    w, h, d = 8, 12, 4
    u, v = uv
    x0, x1, y0, y1 = -2 - inflate, 2 + inflate, -4 - inflate, 4 + inflate
    verts, polys, uvs = [], [], []

    def quad(corners, us, vs):
        base = len(verts)
        verts.extend(corners)
        polys.append(tuple(range(base, base + 4)))
        uvs.extend([(us[0], vs[0]), (us[1], vs[0]), (us[1], vs[1]), (us[0], vs[1])])

    for row in range(h):
        top = h - row + (inflate if row == 0 else 0)
        low = h - row - 1 - (inflate if row == h - 1 else 0)
        vs = (v + d + row, v + d + row + 1)
        quad([(x0, y0, top), (x1, y0, top), (x1, y0, low), (x0, y0, low)], (u, u + d), vs)
        quad([(x1, y0, top), (x1, y1, top), (x1, y1, low), (x1, y0, low)], (u + d, u + d + w), vs)
        quad([(x1, y1, top), (x0, y1, top), (x0, y1, low), (x1, y1, low)], (u + d + w, u + 2 * d + w), vs)
        quad([(x0, y1, top), (x0, y0, top), (x0, y0, low), (x0, y1, low)], (u + 2 * d + w, u + 2 * d + 2 * w), vs)
    quad([(x0, y0, h + inflate), (x0, y1, h + inflate), (x1, y1, h + inflate), (x1, y0, h + inflate)], (u + d, u + d + w), (v, v + d))
    quad([(x0, y0, -inflate), (x0, y1, -inflate), (x1, y1, -inflate), (x1, y0, -inflate)], (u + d + w, u + d + 2 * w), (v, v + d))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop, (tu, tv) in zip(layer.data, uvs):
        loop.uv = (tu / TEX, 1 - tv / TEX)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    TRUNKS.append((mesh, [Vector(co) for co in verts]))
    return obj


def bend_trunks(j):
    turn = j["chest"].rotation_euler
    pivot = Vector(WAIST)
    cache = {}
    for mesh, rest in TRUNKS:
        for index, co in enumerate(rest):
            share = min(1.0, max(0.0, (co.z - WAIST_FROM) / (WAIST_TO - WAIST_FROM)))
            share = share * share * (3 - 2 * share)
            key = round(share, 5)
            if key not in cache:
                cache[key] = Euler((turn.x * share, turn.y * share, turn.z * share), "XYZ").to_matrix()
            mesh.vertices[index].co = cache[key] @ (co - pivot) + pivot
        mesh.update()


MEDAL_COLOURS = {"ribbon": (0.78, 0.10, 0.12), "rim": (0.78, 0.56, 0.08), "gold": (1.0, 0.80, 0.18), "shine": (1.0, 0.95, 0.62)}


def flat(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*[c ** 2.2 for c in rgb], 1)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def medal(parent):
    """A ribbon round the neck and a gold disc on the chest. It hangs from the
    chest pivot, so it rides the shoulders; a pose shows it with "medal": 1."""
    verts, polys, slots = [], [], []
    names = list(MEDAL_COLOURS)

    def slab(colour, outline, x0, x1):
        base = len(verts)
        count = len(outline)
        verts.extend([(x0, y, z) for y, z in outline] + [(x1, y, z) for y, z in outline])
        polys.append(tuple(base + count + k for k in range(count)))
        slots.append(names.index(colour))
        for k in range(count):
            polys.append((base + k, base + (k + 1) % count, base + count + (k + 1) % count, base + count + k))
            slots.append(names.index(colour))

    def disc(radius, sides=12):
        return [(radius * math.cos(2 * math.pi * k / sides), 1.7 + radius * math.sin(2 * math.pi * k / sides)) for k in range(sides)]

    front = 2.0
    # The ribbon comes down from each shoulder to the disc.
    slab("ribbon", [(-3.4, 6.0), (-2.4, 6.0), (0.5, 2.4), (-0.5, 2.4)], front, front + 0.18)
    slab("ribbon", [(2.4, 6.0), (3.4, 6.0), (0.5, 2.4), (-0.5, 2.4)], front, front + 0.18)
    slab("rim", disc(1.55), front + 0.1, front + 0.42)
    slab("gold", disc(1.2), front + 0.2, front + 0.5)
    slab("shine", [(-0.45, 2.15), (0.1, 2.5), (0.3, 2.2), (-0.25, 1.85)], front + 0.3, front + 0.54)
    mesh = bpy.data.meshes.new("medal")
    mesh.from_pydata(verts, [], polys)
    for name in names:
        mesh.materials.append(flat("medal_" + name, MEDAL_COLOURS[name]))
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
    obj = bpy.data.objects.new("medal", mesh)
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


# Elytra: the wings of the game, on his back. Drawn here, not taken from the
# game's texture: a lilac-grey membrane, a darker leading edge and two veins.
# A pose shows them with "elytra": 1 and opens them with "wings" (0 folded
# against the back .. 1 spread to glide).
WING_COLOURS = {"membrane": (0.60, 0.58, 0.72), "edge": (0.34, 0.32, 0.47), "vein": (0.47, 0.45, 0.60)}
# The outline of one wing hanging from its hinge: across (away from the
# spine) and down, in skin units. The game's is 10 wide and 20 long.
WING_OUTLINE = [(-1.0, 0.0), (9.0, 0.0), (10.0, -6.0), (8.5, -13.0), (5.0, -20.0), (1.5, -20.0), (-1.0, -11.0)]
WING_EDGE = [(-1.0, 0.0), (9.0, 0.0), (10.0, -6.0), (8.5, -13.0), (5.0, -20.0), (4.0, -19.4), (7.2, -12.6), (8.6, -6.0), (7.9, -1.6), (-1.0, -1.6)]
WING_VEINS = [[(2.4, -1.6), (3.2, -1.6), (2.6, -18.6), (1.9, -18.4)], [(5.2, -1.6), (6.0, -1.6), (5.0, -15.4), (4.3, -15.0)]]
# How high on the back they hinge, above the waist.
WING_HINGE = 1.0
WING_FOLDED = (14.0, 12.0)   # out to the side and back, in degrees
WING_SPREAD = (46.0, 0.0)


def wing(name, parent, side):
    """One wing on a hinge at the shoulder blade. `side` is -1 for his right."""
    # At the middle of the back, not at the shoulders: up there they stood
    # behind his head.
    hinge = pivot(name, parent, (-2.35, side * 0.6, WING_HINGE))
    verts, polys, slots = [], [], []
    names = list(WING_COLOURS)

    def slab(colour, outline, x0, x1):
        base = len(verts)
        count = len(outline)
        verts.extend([(x0, side * y, z) for y, z in outline] + [(x1, side * y, z) for y, z in outline])
        for ring in (range(count), range(count, 2 * count)):
            polys.append(tuple(base + k for k in ring))
            slots.append(names.index(colour))
        for k in range(count):
            polys.append((base + k, base + (k + 1) % count, base + count + (k + 1) % count, base + count + k))
            slots.append(names.index(colour))

    slab("membrane", WING_OUTLINE, -0.5, 0.0)
    slab("edge", WING_EDGE, -0.62, 0.12)
    for vein in WING_VEINS:
        slab("vein", vein, -0.58, 0.08)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], polys)
    for colour in names:
        mesh.materials.append(flat("wing_" + colour, WING_COLOURS[colour]))
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
    obj = bpy.data.objects.new(name + "_mesh", mesh)
    obj.parent = hinge
    bpy.context.collection.objects.link(obj)
    return hinge, obj


# The firework rocket he lights to take off, in his right hand: a red paper
# tube with a pale cap and a stick. A pose shows it with "rocket": 1.
ROCKET_COLOURS = {"paper": (0.80, 0.17, 0.15), "band": (0.93, 0.90, 0.80), "stick": (0.55, 0.40, 0.24)}
# Each piece: colour, then the box it fills in the forearm's own space, where
# the hand is at z = -6 and forward is +x.
ROCKET_PIECES = [
    ("stick", (1.05, -0.3, -13.4), (1.65, 0.3, -8.6)),
    ("paper", (0.3, -1.05, -9.6), (2.4, 1.05, -3.8)),
    ("band", (0.2, -1.15, -7.6), (2.5, 1.15, -6.4)),
    ("band", (0.6, -0.75, -3.8), (2.1, 0.75, -2.7)),
]


def rocket(parent):
    verts, polys, slots = [], [], []
    names = list(ROCKET_COLOURS)
    for colour, (x0, y0, z0), (x1, y1, z1) in ROCKET_PIECES:
        base = len(verts)
        verts.extend([(x, y, z) for z in (z0, z1) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))])
        for face in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            polys.append(tuple(base + k for k in face))
            slots.append(names.index(colour))
    mesh = bpy.data.meshes.new("rocket")
    mesh.from_pydata(verts, [], polys)
    for colour in names:
        mesh.materials.append(flat("rocket_" + colour, ROCKET_COLOURS[colour]))
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
    obj = bpy.data.objects.new("rocket", mesh)
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def pin(name, parent, mat, loc, uv, radius=2.0, half=2.0, sides=20):
    """A cylinder along Y at a limb joint, coloured from the middle of the limb."""
    ring = [(radius * math.cos(2 * math.pi * k / sides), radius * math.sin(2 * math.pi * k / sides)) for k in range(sides)]
    verts = [(x, y, z) for y in (-half, half) for x, z in ring]
    polys = [(k, (k + 1) % sides, sides + (k + 1) % sides, sides + k) for k in range(sides)]
    polys += [tuple(range(sides - 1, -1, -1)), tuple(range(sides, 2 * sides))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop in layer.data:
        loop.uv = ((uv[0] + 2) / TEX, 1 - (uv[1] + 4 + 6) / TEX)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.parent = parent
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def pivot(name, parent, loc):
    obj = bpy.data.objects.new(name, None)
    obj.parent = parent
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def patch(name, parent, mat, texel, wide, tall):
    """A flat piece on the face, painted with one pixel of the skin. Its origin
    is the middle of its top edge."""
    verts = [(0, -wide / 2, 0), (0, wide / 2, 0), (0, wide / 2, -tall), (0, -wide / 2, -tall)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    layer = mesh.uv_layers.new(name="uv")
    for loop in layer.data:
        loop.uv = ((texel[0] + 0.5) / TEX, 1 - (texel[1] + 0.5) / TEX)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


# Eyes that move. The skin paints both pixels of each eye white; the pupil is
# a piece of its own that slides between them, and a lid of skin comes down
# over the eye to blink. Their colours are two spare pixels of the skin, so
# they take the same light as the face. A pose moves them with "eyes" (-1 to
# his right .. 1 to his left, 0 is both pupils by the nose) and "blink" (0..1).
# A skin with its eyes painted in, like the old panda, needs them off: a poses
# file does that with "eyes_rig": false.
EYE_ROW = 3.0          # top of the eye row, in head units
PUPIL_TEXEL, LID_TEXEL = (0, 0), (1, 0)


EYES_RIG = True


def build(mat):
    j = {}
    j["root"] = pivot("root", None, (0, 0, 12))
    j["torso"] = pivot("torso", j["root"], (0, 0, 0))
    # The waist: without it the whole trunk moves as one plank. Head and arms
    # hang from it; the trunk itself follows it slice by slice, in `bend_trunks`.
    j["chest"] = pivot("chest", j["torso"], WAIST)
    j["head"] = pivot("head", j["chest"], (0, 0, 6))
    trunk("body", j["torso"], mat, (16, 16))
    trunk("jacket", j["torso"], mat, (16, 32), inflate=0.25)
    box("skull", j["head"], mat, (-4, -4, 0), (8, 8, 8), (0, 0), (8, 8, 8))
    box("hat", j["head"], mat, (-4, -4, 0), (8, 8, 8), (32, 0), (8, 8, 8), inflate=0.4)

    limbs = {
        "arm_r": (j["chest"], (0, -6, 4), (40, 16), (40, 32)),
        "arm_l": (j["chest"], (0, 6, 4), (32, 48), (48, 48)),
        "leg_r": (j["root"], (0, -2, 0), (0, 16), (0, 32)),
        "leg_l": (j["root"], (0, 2, 0), (16, 48), (0, 48)),
    }
    for name, (parent, loc, uv, uv_over) in limbs.items():
        top = 2 if name.startswith("arm") else 0
        upper = j[name] = pivot(name, parent, loc)
        lower = j[name + "_bend"] = pivot(name + "_bend", upper, (0, 0, top - 6))
        for layer, origin, grow in (("", uv, 0.0), ("_over", uv_over, 0.25)):
            high = box(name + "_up" + layer, upper, mat, (-2, -2, top - 6), (4, 4, 6), origin, (4, 12, 4), rows=(0, 6), inflate=grow)
            low = box(name + "_lo" + layer, lower, mat, (-2, -2, -6), (4, 4, 6), origin, (4, 12, 4), rows=(6, 12), inflate=grow)
            mitre(name + "_bend", high, "bottom", "parent")
            mitre(name + "_bend", low, "top", "child")
        pin(name + "_pin", upper, mat, (0, 0, top - 6), uv)
    build.eyes = {
        "pupil_l": patch("pupil_l", j["head"], mat, PUPIL_TEXEL, 1, 1),
        "pupil_r": patch("pupil_r", j["head"], mat, PUPIL_TEXEL, 1, 1),
        "lid_l": patch("lid_l", j["head"], mat, LID_TEXEL, 2, 1),
        "lid_r": patch("lid_r", j["head"], mat, LID_TEXEL, 2, 1),
    }
    build.medal = medal(j["chest"])
    build.medal.hide_render = True
    build.rocket = rocket(j["arm_r_bend"])
    build.rocket.hide_render = True
    build.wings = [(*wing("wing_r", j["chest"], -1), -1), (*wing("wing_l", j["chest"], 1), 1)]
    return j


def apply(j, pose):
    """A joint takes a pitch, or [pitch, side, twist] in degrees.

    Positive pitch always means forward: a limb swings toward +X, the torso
    and chest lean ahead, the head looks down. Limbs hang below their pivot and
    the trunk and head stand above theirs, so the same lean is the opposite
    rotation.
    Side and twist are plain rotations about X and Z.
    """
    root = j["root"]
    root.location = (pose.get("x", 0), pose.get("y", 0), 12 + pose.get("z", 0))
    # Turn on the body's own axis first, then lean in the world.
    root.rotation_mode = "ZYX"
    root.rotation_euler = [math.radians(v) for v in pose.get("root", (0, 0, 0))]
    for name, obj in j.items():
        if name == "root":
            continue
        value = pose.get(name, 0)
        pitch, side, twist = value if isinstance(value, list) else (value, 0, 0)
        sign = 1 if name in ("torso", "chest", "head") else -1
        obj.rotation_euler = (math.radians(side), sign * math.radians(pitch), math.radians(twist))
    # Yaw toward the world camera, which sits on -Y.
    j["head"].rotation_euler.z -= math.radians(pose.get("head_yaw", 0))
    apply_mitres(j)
    bend_trunks(j)
    build.medal.hide_render = not pose.get("medal")
    build.rocket.hide_render = not pose.get("rocket")
    spread = max(0.0, min(1.0, pose.get("wings", 0)))
    out = WING_FOLDED[0] + (WING_SPREAD[0] - WING_FOLDED[0]) * spread
    back = WING_FOLDED[1] + (WING_SPREAD[1] - WING_FOLDED[1]) * spread
    for hinge, mesh, side in build.wings:
        # Hanging down from the hinge: a turn about X swings the tip out to
        # its side, one about Y carries it back.
        hinge.rotation_euler = (math.radians(side * out), math.radians(back), 0)
        mesh.hide_render = not pose.get("elytra")
    gaze = max(-1.0, min(1.0, pose.get("eyes", 0)))
    blink = max(0.0, min(1.0, pose.get("blink", 0)))
    eyes = build.eyes
    eyes["pupil_l"].location = (4.03, -2 + 0.5 * min(1, 1 + 2 * gaze), EYE_ROW)
    eyes["pupil_r"].location = (4.03, 2 + 0.5 * max(-1, -1 + 2 * gaze), EYE_ROW)
    for side, y in (("lid_l", -2), ("lid_r", 2)):
        eyes[side].location = (4.06, y, EYE_ROW)
        eyes[side].scale = (1, 1, max(blink, 0.001))
    for name, obj in eyes.items():
        obj.hide_render = not EYES_RIG or (name.startswith("lid") and blink <= 0)


def world_camera(foot_y=FOOT_Y):
    return {
        "type": "ORTHO",
        "resolution": (CELL_W, CELL_H),
        "ortho_scale": CELL_H / PX_PER_UNIT,
        "location": ((CELL_W / 2 - CENTER_X) / PX_PER_UNIT, -200, (foot_y - CELL_H / 2) / PX_PER_UNIT),
        "target": ((CELL_W / 2 - CENTER_X) / PX_PER_UNIT, 0, (foot_y - CELL_H / 2) / PX_PER_UNIT),
    }


def setup_scene(shot):
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj)
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = shot["resolution"]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.render.filter_size = 1.0
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = shot["type"]
    if shot["type"] == "ORTHO":
        cam_data.ortho_scale = shot["ortho_scale"]
    else:
        # Vertical field of view, so a cell keeps its framing if it gets wider.
        cam_data.sensor_fit = "VERTICAL"
        cam_data.angle_y = math.radians(shot["fov"])
    cam_data.clip_end = 2000
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = shot["location"]
    aim = Vector(shot["target"]) - Vector(shot["location"])
    cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    SKIN, POSES, OUT = args[:3]
    foot_y = int(args[3]) if len(args) > 3 else FOOT_Y
    with open(POSES) as fh:
        data = json.load(fh)
    if isinstance(data, list):
        data = {"frames": data}
    frames = data["frames"]
    global EYES_RIG
    EYES_RIG = bool(data.get("eyes_rig", True))
    shot = data.get("camera") or world_camera(foot_y)
    # A sheet fitted to an older one carries the scale that one was drawn at.
    if "zoom" in data and shot["type"] == "ORTHO":
        shot["ortho_scale"] /= data["zoom"]
    scene = setup_scene(shot)
    joints = build(make_material(bpy.data.images.load(SKIN), data.get("light") or WORLD_LIGHT))
    # "probe": {"joint": ..., "point": [x, y, z]} prints where that point of a joint
    # lands in the cell on every frame. It is how the hand that lets go of the pearl
    # gets its coordinates, instead of being read off the picture.
    probe = data.get("probe")
    for index, pose in enumerate(frames, start=1):
        apply(joints, pose)
        if probe:
            bpy.context.view_layer.update()
            spot = world_to_camera_view(scene, scene.camera, joints[probe["joint"]].matrix_world @ Vector(probe["point"]))
            width, height = scene.render.resolution_x, scene.render.resolution_y
            print(f"PROBE f{index:03d} {spot.x * width:.1f} {(1 - spot.y) * height:.1f}")
        scene.render.filepath = f"{OUT}/f{index:03d}.png"
        bpy.ops.render.render(write_still=True)
    print(f"RENDERED {len(frames)} frames -> {OUT}")


if __name__ == "__main__":
    main()
