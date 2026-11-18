"""Renders the things planted in the world that are not blocks, from the
game's own textures: the chest, closed and open, the sign, and the lamp post.

Usage: blender -b -P props.py -- <chest|sign|lamp> <texture.png> <out_dir>

A chest is a 14x14x14 model with a lid on a hinge and a latch, unwrapped on a
64x64 sheet (entity/chest/normal.png). A sign is a board on a stick, on a
32x32 one (block/oak_sign.png). The lamp post is built from four block
textures, so it is fed one 64x64 sheet with them side by side along the top:
the lantern's first frame, oak planks, stone bricks and dark oak planks.

  magick -size 64x64 xc:none \( lantern.png -crop 16x16+0+0 +repage \) \
    -geometry +0+0 -composite oak_planks.png -geometry +16+0 -composite \
    stone_bricks.png -geometry +32+0 -composite \
    dark_oak_planks.png -geometry +48+0 -composite lamp_sheet.png

None of them goes through world.py, which only
knows cubes with one texture per face. They do share its camera and its light,
so they sit in the world like everything else there.

Every picture of a kind is cut to the same width and the same foot, so
swapping one for another does not move the thing.
"""
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

KIND, TEXTURE, OUT = sys.argv[sys.argv.index("--") + 1:][:3]

CANVAS = (3840, 3000)
BLOCK_PX = 133
FOV = 7.0
SURFACE_ROW = 2811
FRONT, END = 0.9, 0.72
# Side of the texture sheet, where the thing stands in blocks from the left
# edge of the canvas, and the box it can reach, in texture pixels. The chest
# stands left of the stage, lid up included; the sign, in the middle.
SHEET, AT_X, REACH = {"chest": (64, 5.2, (16, 22, 24)), "sign": (32, 14.4, (24, 16, 26)),
                      "lamp": (64, 14.4, (40, 16, 50))}[KIND]
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


def box(verts, polys, uvs, lo, hi, sheet_at=None, hinge=None, angle=0.0, faces=None):
    """One box of the model, in texture pixels: x across, y away from the
    camera, z up. `sheet_at` is its corner on the sheet, laid out as the game
    lays out every box of an entity; the sides are stored upside down there.
    A block model says where each face is instead: `faces` maps front, back,
    left, right, top and bottom to (u0, u1, top row, bottom row)."""
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    w, d, h = round(x1 - x0), round(y1 - y0), round(z1 - z0)
    if faces is None:
        u, v = sheet_at
        rows = (v + d + h, v + d)
        faces = {"front": (u + 2 * d + w, u + 2 * d + 2 * w, *rows), "back": (u + d, u + d + w, *rows),
                 "left": (u, u + d, *rows), "right": (u + d + w, u + 2 * d + w, *rows),
                 "top": (u + d + w, u + d + 2 * w, v, v + d), "bottom": (u + d, u + d + w, v, v + d)}

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

    quad([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], *faces["front"])
    quad([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], *faces["back"])
    quad([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], *faces["left"])
    quad([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], *faces["right"])
    quad([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], *faces["top"])
    quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], *faces["bottom"])


def link(name, verts, polys, uvs):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop, uv in zip(layer.data, uvs):
        loop.uv = uv
    mesh.materials.append(MATERIAL)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (AT_X, 0, 0)
    bpy.context.collection.objects.link(obj)
    return obj


def sign(_):
    """A board on a stick. The sheet has the two faces of the board and the
    stick; the board's edges are the outer two pixels of its own face."""
    verts, polys, uvs = [], [], []
    stick = {"front": (28, 30, 0, 14), "back": (28, 30, 0, 14), "left": (30, 32, 0, 14),
             "right": (30, 32, 0, 14), "top": (28, 30, 0, 2), "bottom": (28, 30, 0, 2)}
    board = {"front": (0, 24, 0, 12), "back": (0, 24, 14, 26), "left": (0, 2, 0, 12),
             "right": (22, 24, 0, 12), "top": (0, 24, 0, 2), "bottom": (0, 24, 10, 12)}
    box(verts, polys, uvs, (11, 7, 0), (13, 9, 14), faces=stick)
    box(verts, polys, uvs, (0, 7, 14), (24, 9, 26), faces=board)
    return link("sign", verts, polys, uvs)


def lamp(_):
    """A lamp post as players build them: a stone footing, a post of planks, a
    dark crossbar under a stone cap, and a lantern hanging from each end. It
    is symmetric on purpose: it stands behind the middle of a row of signs.

    Each lantern is the game's hanging one, chain, cap and body, each mapped
    to the part of the lantern's sheet the game uses for it."""
    verts, polys, uvs = [], [], []
    OAK, STONE, DARK = 16, 32, 48

    def block(lo, hi, sheet, u=0, v=0):
        """A box wrapped in a block texture, one texel per pixel, starting at
        (u, v) of that texture."""
        w, d, h = hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]
        front = (sheet + u, sheet + u + w, v, v + h)
        side = (sheet + u, sheet + u + d, v, v + h)
        top = (sheet + u, sheet + u + w, v, v + d)
        box(verts, polys, uvs, lo, hi, faces={"front": front, "back": front, "left": side,
                                              "right": side, "top": top, "bottom": top})

    block((14, 3, 0), (26, 13, 6), STONE, 2, 0)
    block((16, 4, 6), (24, 12, 10), STONE, 4, 8)
    for z0, z1 in ((10, 26), (26, 42)):
        block((18, 6, z0), (22, 10, z1), OAK, 6, 0)
    block((17, 5, 39), (23, 11, 42), DARK, 0, 0)
    # The crossbar is two blocks long; a texture is one.
    block((4, 6, 42), (20, 10, 45), DARK, 0, 4)
    block((20, 6, 42), (36, 10, 45), DARK, 0, 4)
    block((15, 4, 45), (25, 12, 47), STONE, 3, 0)
    cap = (1, 5, 0, 2)
    chain = (2, 3, 0, 2)
    body = (0, 6, 2, 9)
    for x in (7, 33):
        box(verts, polys, uvs, (x - 0.5, 7.5, 38), (x + 0.5, 8.5, 42), faces={
            "front": chain, "back": chain, "left": chain, "right": chain, "top": chain, "bottom": chain})
        box(verts, polys, uvs, (x - 2, 6, 36), (x + 2, 10, 38), faces={
            "front": cap, "back": cap, "left": cap, "right": cap,
            "top": (1, 5, 10, 14), "bottom": (1, 5, 10, 14)})
        box(verts, polys, uvs, (x - 3, 5, 29), (x + 3, 11, 36), faces={
            "front": body, "back": body, "left": body, "right": body,
            "top": (0, 6, 9, 15), "bottom": (0, 6, 9, 15)})
    return link("lamp", verts, polys, uvs)


def chest(angle):
    verts, polys, uvs = [], [], []
    hinge = (15, 9)
    # A hair inside the lid, which shares its faces for one pixel of height.
    inset = 0.004
    box(verts, polys, uvs, (1 + inset, 1 + inset, 0), (15 - inset, 15 - inset, 10), (0, 19))
    box(verts, polys, uvs, (1, 1, 9), (15, 15, 14), (0, 0), hinge, angle)
    box(verts, polys, uvs, (7, 0, 7), (9, 1, 11), (0, 0), hinge, angle)
    return link("chest", verts, polys, uvs)


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
    # Only the corner of the canvas the thing can reach. The whole canvas at
    # this size is 46 Mpx of nothing.
    bpy.context.view_layer.update()
    reach = [world_to_camera_view(scene, cam, Vector((AT_X + x / 16, y / 16, z / 16)))
             for x in (0, REACH[0]) for y in (0, REACH[1]) for z in (0, REACH[2])]
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
SHOTS = {"chest": (chest, (("chest_closed", 0.0), ("chest_open", OPEN))), "sign": (sign, (("sign", 0.0),)),
         "lamp": (lamp, (("lamp", 0.0),))}
build, takes = SHOTS[KIND]
for name, angle in takes:
    obj = build(angle)
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
    print(f"PROP {name} {size[0]}x{size[1]} at {OVERSAMPLE}x")
