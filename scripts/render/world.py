"""Renders a world layer from a list of blocks, headless.

Usage: blender -b -P world.py -- <textures_dir> <scene.json> <out.png>

A layer is what Mine-imator rendered: blocks seen from the side, flat light,
no sky. The camera is the one ASSETS.md fixes for every biome, so a layer made
here lines up with the ones made there:

    canvas 3840 x 3000, one block = 133 px, field of view 7 degrees

It is a real camera, not a tile map, because the old layers are not flat: the
camera sits some ten blocks above the ground, so the top of the grass shows as
a thin band and leaves stack up in depth.

`scene.json`: {"surface_row": 2791, "blocks": [[x, depth, height, "name"], ...],
"plants": [[x, depth, height, "name"], ...], "ground_depth": 5}. Height 0 is the
block whose top is the surface; depth 0 is the row nearest the camera. A name
ending in "@half" is the lower half of that block: a slab.

"anchors": {"name": [x, depth, height above the surface], ...} prints the pixel
where each point lands, as `ANCHOR name x y`. A block further back sits lower
in the picture than its height alone says, because the camera looks down on the
ground, so where the character stands is asked of the render, not worked out.

"parts": [[x, depth, height, "texture", [x0, y0, z0, x1, y1, z1]], ...] are
boxes smaller than a block, in fractions of the cell they sit in (they may run
past it). Stairs, carpets, posts, cloth: anything that is not a full cube. The
texture is cut to the box, as the game does, so a half-height box shows half.

"depth_shade": light lost per block of depth, 0 by default. For a scene of a
single material, which flat light leaves without any depth.

`surface_row` is where import-layers.py will find the surface: the first row
that is ground from edge to edge. That is the far edge of the ground's top, not
the near one, so the scene says how many blocks deep its ground is and the
camera drops by what that depth rises on screen.
"""
import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

TEXTURES, SCENE, OUT = sys.argv[sys.argv.index("--") + 1:][:3]

CANVAS = (3840, 3000)
BLOCK_PX = 133
FOV = 7.0

# Biome colours for the textures the game ships in grey.
GRASS = (0.72, 0.94, 0.43)
LEAVES = (0.50, 0.74, 0.24)
SPRUCE = (0.38, 0.60, 0.38)
TINTS = {"grass_block_top": GRASS, "grass_block_side_overlay": GRASS, "short_grass": GRASS,
         "tall_grass_bottom": GRASS, "tall_grass_top": GRASS, "fern": GRASS, "oak_leaves": LEAVES,
         "spruce_leaves": SPRUCE}

# name -> (top, side, bottom) textures. Anything not listed uses its own name on every face.
FACES = {
    "grass_block": ("grass_block_top", "grass_block_side", "dirt"),
    "oak_log": ("oak_log_top", "oak_log", "oak_log_top"),
    "spruce_log": ("spruce_log_top", "spruce_log", "spruce_log_top"),
    "quartz_pillar": ("quartz_pillar_top", "quartz_pillar_side", "quartz_pillar_top"),
    "quartz_block": ("quartz_block_top", "quartz_block_side", "quartz_block_bottom"),
    "cherry_log": ("cherry_log_top", "cherry_log", "cherry_log_top"),
}
SEE_THROUGH = ("leaves", "glass")
materials = {}


def material(texture):
    if texture in materials:
        return materials[texture]
    mat = bpy.data.materials.new(texture)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(TEXTURES, texture + ".png"))
    tex.interpolation = "Closest"
    colour = tex.outputs["Color"]
    # The side of a grass block is dirt with a grey fringe laid over it; the
    # fringe takes the biome colour and the dirt does not.
    if texture == "grass_block_side":
        over = nt.nodes.new("ShaderNodeTexImage")
        over.image = bpy.data.images.load(os.path.join(TEXTURES, "grass_block_side_overlay.png"))
        over.interpolation = "Closest"
        tinted = nt.nodes.new("ShaderNodeVectorMath")
        tinted.operation = "MULTIPLY"
        tinted.inputs[1].default_value = GRASS_LINEAR
        nt.links.new(over.outputs["Color"], tinted.inputs[0])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(over.outputs["Alpha"], mix.inputs["Factor"])
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        nt.links.new(tinted.outputs["Vector"], mix.inputs["B"])
        colour = mix.outputs["Result"]
    elif texture in TINTS:
        tint = nt.nodes.new("ShaderNodeVectorMath")
        tint.operation = "MULTIPLY"
        tint.inputs[1].default_value = tuple(c ** 2.2 for c in TINTS[texture])
        nt.links.new(colour, tint.inputs[0])
        colour = tint.outputs["Vector"]
    # Flat light by face: tops full, the face toward the camera a little under,
    # the ends darker. It is what keeps a step in the ground readable.
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
    light = dark.outputs[0]
    # Optional: what is further back is darker. A scene of one material, lit
    # flat, has no depth at all without it: a hill behind the edge is the
    # same colour as the edge.
    if DEPTH_SHADE > 0:
        where = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geo.outputs["Position"], where.inputs[0])
        fade = nt.nodes.new("ShaderNodeMath")
        fade.operation = "MULTIPLY_ADD"
        fade.use_clamp = True
        fade.inputs[1].default_value = -DEPTH_SHADE
        fade.inputs[2].default_value = 1.0
        nt.links.new(where.outputs["Y"], fade.inputs[0])
        far = nt.nodes.new("ShaderNodeMath")
        far.operation = "MULTIPLY"
        nt.links.new(dark.outputs[0], far.inputs[0])
        nt.links.new(fade.outputs[0], far.inputs[1])
        light = far.outputs[0]
    shaded = nt.nodes.new("ShaderNodeVectorMath")
    shaded.operation = "SCALE"
    nt.links.new(colour, shaded.inputs[0])
    nt.links.new(light, shaded.inputs["Scale"])
    emit = nt.nodes.new("ShaderNodeEmission")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    blend = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(shaded.outputs["Vector"], emit.inputs["Color"])
    nt.links.new(tex.outputs["Alpha"], blend.inputs["Fac"])
    nt.links.new(clear.outputs[0], blend.inputs[1])
    nt.links.new(emit.outputs[0], blend.inputs[2])
    nt.links.new(blend.outputs[0], out.inputs["Surface"])
    materials[texture] = mat
    return mat


FRONT, END = 0.9, 0.72
# Light lost per block of depth; a scene asks for it with "depth_shade".
DEPTH_SHADE = 0.0
GRASS_LINEAR = tuple(c ** 2.2 for c in GRASS)


def build(scene_data):
    cells = {(x, d, h): name for x, d, h, name in scene_data["blocks"]}
    # A slab hides nothing: there is air above it inside its own cell.
    solid = {key for key, name in cells.items()
             if not any(word in name for word in SEE_THROUGH) and not name.endswith("@half")}
    verts, polys, uvs, slots, order = [], [], [], [], {}

    def quad(corners, texture, turn=0, tall=1.0, uv=None):
        base = len(verts)
        verts.extend(corners)
        polys.append(tuple(range(base, base + 4)))
        corner_uvs = uv or [(0, tall), (1, tall), (1, 0), (0, 0)]
        uvs.extend(corner_uvs[turn % 4:] + corner_uvs[:turn % 4])
        slots.append(order.setdefault(texture, len(order)))

    for (x, d, h), name in cells.items():
        half = name.endswith("@half")
        name = name.removesuffix("@half")
        top, side, bottom = FACES.get(name, (name, name, name))
        x0, x1, y0, y1, z0, z1 = x, x + 1, d, d + 1, h - 1, h - (0.5 if half else 0)
        tall = 0.5 if half else 1.0
        hidden = lambda key: key in solid
        # Leaves turn their texture block by block. All the same way up, the
        # holes line up through the whole crown and it reads as a sieve.
        turn = (x * 7 + d * 13 + h * 29) if any(word in name for word in SEE_THROUGH) else 0
        # corners listed top-left, top-right, bottom-right, bottom-left from outside
        if not hidden((x, d - 1, h)):
            quad([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], side, turn, tall)
        if not hidden((x, d + 1, h)):
            quad([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], side, turn, tall)
        if not hidden((x - 1, d, h)):
            quad([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], side, turn, tall)
        if not hidden((x + 1, d, h)):
            quad([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], side, turn, tall)
        if half or not hidden((x, d, h + 1)):
            quad([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], top, turn)
        if not hidden((x, d, h - 1)):
            quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], bottom, turn)

    for x, d, h, name, (a0, b0, c0, a1, b1, c1) in scene_data.get("parts", []):
        top, side, bottom = FACES.get(name, (name, name, name))
        x0, x1, y0, y1, z0, z1 = x + a0, x + a1, d + b0, d + b1, h - 1 + c0, h - 1 + c1
        wrap = lambda v: v - math.floor(v) if v - math.floor(v) > 1e-6 or v == 0 else 1.0
        u0, u1, v0, v1 = a0 % 1, wrap(a1), c0 % 1, wrap(c1)
        w0, w1 = b0 % 1, wrap(b1)
        quad([(x0, y0, z1), (x1, y0, z1), (x1, y0, z0), (x0, y0, z0)], side, uv=[(u0, v1), (u1, v1), (u1, v0), (u0, v0)])
        quad([(x1, y1, z1), (x0, y1, z1), (x0, y1, z0), (x1, y1, z0)], side, uv=[(u0, v1), (u1, v1), (u1, v0), (u0, v0)])
        quad([(x0, y1, z1), (x0, y0, z1), (x0, y0, z0), (x0, y1, z0)], side, uv=[(w0, v1), (w1, v1), (w1, v0), (w0, v0)])
        quad([(x1, y0, z1), (x1, y1, z1), (x1, y1, z0), (x1, y0, z0)], side, uv=[(w0, v1), (w1, v1), (w1, v0), (w0, v0)])
        quad([(x0, y1, z1), (x1, y1, z1), (x1, y0, z1), (x0, y0, z1)], top, uv=[(u0, w1), (u1, w1), (u1, w0), (u0, w0)])
        quad([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], bottom, uv=[(u0, w0), (u1, w0), (u1, w1), (u0, w1)])

    # A plant is two flat cards crossed corner to corner, as in the game.
    for x, d, h, name in scene_data.get("plants", []):
        z0, z1 = h, h + 1
        quad([(x, d, z1), (x + 1, d + 1, z1), (x + 1, d + 1, z0), (x, d, z0)], name)
        quad([(x, d + 1, z1), (x + 1, d, z1), (x + 1, d, z0), (x, d + 1, z0)], name)

    mesh = bpy.data.meshes.new("world")
    mesh.from_pydata(verts, [], polys)
    layer = mesh.uv_layers.new(name="uv")
    for loop, uv in zip(layer.data, uvs):
        loop.uv = uv
    for texture in order:
        mesh.materials.append(material(texture))
    for poly, slot in zip(mesh.polygons, slots):
        poly.material_index = slot
    obj = bpy.data.objects.new("world", mesh)
    bpy.context.collection.objects.link(obj)
    return len(polys)


def camera(scene, surface_row, ground_depth):
    width, height = CANVAS
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    data = bpy.data.cameras.new("cam")
    data.sensor_fit = "VERTICAL"
    data.angle_y = math.radians(FOV)
    blocks_tall = height / BLOCK_PX
    distance = blocks_tall / 2 / math.tan(math.radians(FOV / 2))
    data.clip_end = distance * 3
    cam = bpy.data.objects.new("cam", data)
    # Level with the middle of the canvas, which puts the surface where the
    # layer says it is; depth 0 is the plane where a block measures 133 px.
    above = (surface_row - height / 2) / BLOCK_PX
    above += ground_depth * above / distance
    cam.location = (width / BLOCK_PX / 2, -distance, above)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam


scene = bpy.context.scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj)
for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
with open(SCENE) as fh:
    data = json.load(fh)
DEPTH_SHADE = float(data.get("depth_shade", 0.0))
faces = build(data)
camera(scene, data.get("surface_row", 2791), data.get("ground_depth", 0))
bpy.context.view_layer.update()
for name, point in data.get("anchors", {}).items():
    spot = world_to_camera_view(scene, scene.camera, Vector(point))
    print(f"ANCHOR {name} {spot.x * CANVAS[0]:.1f} {(1 - spot.y) * CANVAS[1]:.1f}")
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print(f"RENDERED {faces} faces -> {OUT}")
