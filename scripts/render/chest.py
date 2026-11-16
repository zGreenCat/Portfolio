"""Renders the chest, closed and open, from the game's own texture.

Usage: blender -b -P chest.py -- <chest_texture.png> <out_dir>

A chest is not a block: it is a 14x14x14 model with a lid on a hinge and a
latch, unwrapped on a 64x64 sheet. So it does not go through world.py, which
only knows cubes with one texture per face. It does share its camera and its
light, placed where the chest stands next to the stage, so it sits in the
taiga like everything else there.

Writes chest_closed.png and chest_open.png, cut to the same width and the same
foot, so swapping one for the other does not move the chest.
"""
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

TEXTURE, OUT = sys.argv[sys.argv.index("--") + 1:][:2]

CANVAS = (3840, 3000)
BLOCK_PX = 133
FOV = 7.0
SURFACE_ROW = 2811
FRONT, END = 0.9, 0.72
SHEET = 64
# Blocks from the left edge of the stage layer: where it stands on the site.
AT_X = 5.2
OVERSAMPLE = 2
# The lid swings a quarter turn back, as in the game.
OPEN = -90.0


def material():
    mat = bpy.data.materials.new("chest")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(TEXTURE)
    tex.interpolation = "Closest"
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    split = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], split.inputs[0])
    side = nt.nodes.new("ShaderNodeMath")
    side.operation = "ABSOLUTE"
    nt.links.new(split.outputs["X"], side.inputs[0])
    lit = nt.nodes.new("ShaderNodeMath")
    lit.operation = "MULTIPLY_ADD"
    lit.inputs[1].default_value = 1 - FRONT
    lit.inputs[2].default_value = FRONT
    nt.links.new(split.outputs["Z"], lit.inputs[0])
    dark = nt.nodes.new("ShaderNodeMath")
    dark.operation = "MULTIPLY_ADD"
    dark.inputs[1].default_value = -(FRONT - END)
    nt.links.new(side.outputs[0], dark.inputs[0])
    nt.links.new(lit.outputs[0], dark.inputs[2])
    shaded = nt.nodes.new("ShaderNodeVectorMath")
    shaded.operation = "SCALE"
    nt.links.new(tex.outputs["Color"], shaded.inputs[0])
    nt.links.new(dark.outputs[0], shaded.inputs["Scale"])
    emit = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(shaded.outputs["Vector"], emit.inputs["Color"])
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def box(verts, polys, uvs, lo, hi, sheet_at, hinge=None, angle=0.0):
    """One box of the model, in texture pixels: x across, y away from the
    camera, z up. `sheet_at` is its corner on the sheet, laid out as the game
    lays out every box. The sides are stored upside down there."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    w, d, h = round(x1 - x0), round(y1 - y0), round(z1 - z0)
    u, v = sheet_at

    def turned(point):
        if hinge is None:
            return point
        x, y, z = point
        dy, dz = y - hinge[0], z - hinge[1]
        c, s = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        return (x, hinge[0] + dy * c - dz * s, hinge[1] + dy * s + dz * c)

    def quad(corners, ua, ub, top_row, bottom_row):
        base = len(verts)
        verts.extend(tuple(c / 16 for c in turned(p)) for p in corners)
        polys.append((base, base + 1, base + 2, base + 3))
        uvs.extend((a / SHEET, 1 - b / SHEET) for a, b in
                   ((ua, top_row), (ub, top_row), (ub, bottom_row), (ua, bottom_row)))

    rows = (v + d + h, v + d)
    quad([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], u + 2 * d + w, u + 2 * d + 2 * w, *rows)
    quad([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], u + d, u + d + w, *rows)
    quad([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], u, u + d, *rows)
    quad([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], u + d + w, u + 2 * d + w, *rows)
    quad([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], u + d + w, u + d + 2 * w, v, v + d)
    quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], u + d, u + d + w, v, v + d)


def chest(angle):
    verts, polys, uvs = [], [], []
    hinge = (15, 9)
    # A hair inside the lid, which shares its faces for one pixel of height.
    inset = 0.004
    box(verts, polys, uvs, (1 + inset, 1 + inset, 0), (15 - inset, 15 - inset, 10), (0, 19))
    box(verts, polys, uvs, (1, 1, 9), (15, 15, 14), (0, 0), hinge, angle)
    box(verts, polys, uvs, (7, 0, 7), (9, 1, 11), (0, 0), hinge, angle)
    mesh = bpy.data.meshes.new("chest")
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop, uv in zip(layer.data, uvs):
        loop.uv = uv
    mesh.materials.append(MATERIAL)
    obj = bpy.data.objects.new("chest", mesh)
    obj.location = (AT_X, 0, 0)
    bpy.context.collection.objects.link(obj)
    return obj


def camera(scene):
    width, height = CANVAS
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100 * OVERSAMPLE
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    data = bpy.data.cameras.new("cam")
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(FOV)
    distance = height / BLOCK_PX / 2 / math.tan(math.radians(FOV / 2))
    data.clip_end = distance * 3
    cam = bpy.data.objects.new("cam", data)
    cam.location = (width / BLOCK_PX / 2, -distance, (SURFACE_ROW - height / 2) / BLOCK_PX)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    # Only the corner of the canvas the chest can reach, lid up included. The
    # whole canvas at this size is 46 Mpx of nothing.
    bpy.context.view_layer.update()
    reach = [world_to_camera_view(scene, cam, Vector((AT_X + x / 16, y / 16, z / 16)))
             for x in (0, 16) for y in (0, 22) for z in (0, 24)]
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x = min(p.x for p in reach)
    scene.render.border_max_x = max(p.x for p in reach)
    scene.render.border_min_y = min(p.y for p in reach)
    scene.render.border_max_y = max(p.y for p in reach)


def box_of(path):
    image = bpy.data.images.load(path)
    width, height = image.size
    alpha = image.pixels[:][3::4]
    xs = [i % width for i, a in enumerate(alpha) if a > 0.02]
    ys = [i // width for i, a in enumerate(alpha) if a > 0.02]
    bpy.data.images.remove(image)
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def cut(path, x0, y0, x1, y1):
    image = bpy.data.images.load(path)
    width = image.size[0]
    pixels = image.pixels[:]
    rows = []
    for y in range(y0, y1):
        rows.extend(pixels[(y * width + x0) * 4:(y * width + x1) * 4])
    out = bpy.data.images.new("cut", x1 - x0, y1 - y0, alpha=True)
    out.pixels = rows
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(image)
    bpy.data.images.remove(out)
    return x1 - x0, y1 - y0


scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
MATERIAL = material()
camera(scene)
shots = {}
for name, angle in (("chest_closed", 0.0), ("chest_open", OPEN)):
    obj = chest(angle)
    path = os.path.join(OUT, name + ".png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(obj)
    shots[name] = (path, box_of(path))
left = min(b[0] for _, b in shots.values())
right = max(b[2] for _, b in shots.values())
foot = min(b[1] for _, b in shots.values())
for name, (path, bounds) in shots.items():
    size = cut(path, left, foot, right, bounds[3])
    print(f"CHEST {name} {size[0]}x{size[1]} at {OVERSAMPLE}x")
