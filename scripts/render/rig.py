"""Minecraft-skin rig rendered headless.

Usage: blender -b -P rig.py -- <skin.png> <poses.json> <out_dir>

World units are skin pixels. The character faces +X, up is +Z, and the
camera looks down +Y, so it sees the character's right side in pure profile.
"""
import json
import math
import sys

import bpy

ARGS = sys.argv[sys.argv.index("--") + 1:]
SKIN, POSES, OUT = ARGS[:3]

CELL_W, CELL_H = 460, 600
PX_PER_UNIT = 404 / 32.4
FOOT_Y = int(ARGS[3]) if len(ARGS) > 3 else 548
CENTER_X = 232
TEX = 64
LIGHT = (-0.45, -0.893, 0.0)
SHADE_DEPTH = 0.22


def make_material(image):
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
    dot.inputs[1].default_value = LIGHT
    ramp = nt.nodes.new("ShaderNodeMath")
    ramp.operation = "MULTIPLY_ADD"
    ramp.inputs[1].default_value = SHADE_DEPTH / -LIGHT[1]
    ramp.inputs[2].default_value = 1 - SHADE_DEPTH
    ramp.use_clamp = True
    shade = nt.nodes.new("ShaderNodeVectorMath")
    shade.operation = "SCALE"
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    nt.links.new(dot.outputs["Value"], ramp.inputs[0])
    nt.links.new(tex.outputs["Color"], shade.inputs[0])
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


def pivot(name, parent, loc):
    obj = bpy.data.objects.new(name, None)
    obj.parent = parent
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def build(mat):
    j = {}
    j["root"] = pivot("root", None, (0, 0, 12))
    j["torso"] = pivot("torso", j["root"], (0, 0, 0))
    j["head"] = pivot("head", j["torso"], (0, 0, 12))
    box("body", j["torso"], mat, (-2, -4, 0), (4, 8, 12), (16, 16), (8, 12, 4))
    box("jacket", j["torso"], mat, (-2, -4, 0), (4, 8, 12), (16, 32), (8, 12, 4), inflate=0.25)
    box("skull", j["head"], mat, (-4, -4, 0), (8, 8, 8), (0, 0), (8, 8, 8))
    box("hat", j["head"], mat, (-4, -4, 0), (8, 8, 8), (32, 0), (8, 8, 8), inflate=0.4)

    limbs = {
        "arm_r": (j["torso"], (0, -6, 10), (40, 16), (40, 32)),
        "arm_l": (j["torso"], (0, 6, 10), (32, 48), (48, 48)),
        "leg_r": (j["root"], (0, -2, 0), (0, 16), (0, 32)),
        "leg_l": (j["root"], (0, 2, 0), (16, 48), (0, 48)),
    }
    for name, (parent, loc, uv, uv_over) in limbs.items():
        top = 2 if name.startswith("arm") else 0
        upper = j[name] = pivot(name, parent, loc)
        lower = j[name + "_bend"] = pivot(name + "_bend", upper, (0, 0, top - 6))
        # Each half overlaps the other by 2 so a 90 degree bend keeps a full corner.
        for layer, origin, grow in (("", uv, 0.0), ("_over", uv_over, 0.25)):
            box(name + "_up" + layer, upper, mat, (-2, -2, top - 8), (4, 4, 8), origin, (4, 12, 4), rows=(0, 8), inflate=grow)
            box(name + "_lo" + layer, lower, mat, (-2, -2, -6), (4, 4, 8), origin, (4, 12, 4), rows=(4, 12), inflate=grow)
    return j


def apply(j, pose):
    j["root"].location = (pose.get("x", 0), 0, 12 + pose.get("z", 0))
    for name, obj in j.items():
        if name == "root":
            continue
        # Positive always means forward: a limb swings toward +X, the torso leans
        # ahead, the head looks down. Limbs hang below their pivot and the torso and
        # head stand above theirs, so the same lean is the opposite rotation.
        sign = 1 if name in ("torso", "head") else -1
        obj.rotation_euler = (0, sign * math.radians(pose.get(name, 0)), 0)
    # Yaw toward the camera, which sits on -Y.
    j["head"].rotation_euler.z = -math.radians(pose.get("head_yaw", 0))


def setup_scene():
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj)
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x, scene.render.resolution_y = CELL_W, CELL_H
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.render.filter_size = 1.0
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = CELL_H / PX_PER_UNIT
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = ((CELL_W / 2 - CENTER_X) / PX_PER_UNIT, -200, (FOOT_Y - CELL_H / 2) / PX_PER_UNIT)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene


scene = setup_scene()
joints = build(make_material(bpy.data.images.load(SKIN)))
with open(POSES) as fh:
    frames = json.load(fh)
for index, pose in enumerate(frames, start=1):
    apply(joints, pose)
    scene.render.filepath = f"{OUT}/f{index:03d}.png"
    bpy.ops.render.render(write_still=True)
print(f"RENDERED {len(frames)} frames -> {OUT}")
