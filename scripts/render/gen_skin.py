"""Draws the character's skin: Vicente in blocks. Dark curly hair, browline
glasses, a shadow of beard, an olive crew-neck sweatshirt and brown cargo
trousers. A 64x64 PNG in the classic layout.

Usage: python3 gen_skin.py <skin.png> [avatar.png]

The skin is drawn by this script and not by hand so that a change of colour or
of haircut is one edit and a re-render, like everything else in this folder.
With a second path it also writes the portrait used in "Sobre mí": the face,
front on, with the pupils where the rig rests them.
"""
import sys
from PIL import Image

OUT = sys.argv[1]
AVATAR = sys.argv[2] if len(sys.argv) > 2 else None
img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
px = img.load()

# El reflejo del pelo, bastante más claro que la base: plano no se leía como pelo.
HAIR, HAIR_LIT, HAIR_DARK = (34, 25, 21), (74, 55, 44), (22, 16, 13)
SKIN, SKIN_SHADE, SKIN_LIT = (201, 146, 115), (178, 124, 96), (214, 162, 131)
BEARD_LIT = (74, 54, 44)
STUBBLE = (146, 103, 82)
RIM = (38, 34, 36)
EYE_WHITE, IRIS = (238, 236, 230), (58, 38, 26)
MOUTH = (150, 92, 82)
OLIVE, OLIVE_LIT, OLIVE_DARK, OLIVE_DEEP = (140, 118, 40), (151, 128, 47), (128, 107, 34), (98, 82, 22)
BROWN, BROWN_LIT, BROWN_DARK, BROWN_DEEP = (112, 78, 48), (121, 86, 54), (102, 70, 42), (70, 46, 26)
SHOE, SOLE = (44, 44, 48), (226, 222, 212)


def put(x, y, colour):
    px[x, y] = colour + (255,)


def fill(x0, y0, w, h, colour):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(x, y, colour)


def grain(x0, y0, w, h, base, lit, dark, seed=0):
    """Relleno con un moteado fijo: plano del todo se ve de plástico."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            n = (x * 7 + y * 13 + seed * 5 + (x * y) % 5) % 9
            put(x, y, lit if n == 0 else dark if n in (4, 7) else base)


def faces(u, v, w, h, d):
    """Dónde cae cada cara de una caja en la hoja: (x, y, ancho, alto)."""
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h),
            "front": (u + d, v + d, w, h), "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


# ---------- cabeza ----------
# La cara va escrita como un mapa de 8x8, una letra por píxel. Para que no
# parezca Steve: el flequillo baja y tapa la frente, no hay nariz ni perilla
# marrón —que son justo sus rasgos—, y la barba es solo sombra en la mandíbula.
# Los lentes son de ceja: montura oscura arriba del ojo y nada más. Con aro
# entero eran tres filas de gris en una cara de ocho y se comían los ojos.
#
# Los dos píxeles de cada ojo van en blanco: la pupila la pone el rig, que la
# mueve (ver "Eyes that move" en rig.py).
INK = {"H": HAIR, "h": HAIR_LIT, "d": HAIR_DARK, "S": SKIN, "s": SKIN_SHADE, "L": SKIN_LIT,
       "R": RIM, "W": EYE_WHITE, "b": BEARD_LIT, "t": STUBBLE, "M": MOUTH}
FACE = ["HhHdHHhH", "HHdHhHHd", "hHHHHdHH", "HdLLLLhH", "RRRSSRRR", "SWWSSWWS", "tSSssSSt", "ttbMMbtt"]
# Hasta qué fila baja el pelo por el costado, columna a columna desde la cara
# hacia la nuca, y por detrás.
HAIR_SIDE, HAIR_BACK = [4, 5, 5, 6, 6, 6, 6, 6], 6
# El pelo va en la capa de la cabeza. En la de fuera, solo mechones sueltos
# ("." es hueco): con todo el pelo fuera, la cabeza entera se inflaba y
# quedaba como un casco. Arriba no hay ninguno: la capa de fuera son planos
# sin grosor, y vistos de canto desde delante eran rayitas flotando sobre la
# cabeza.
TUFTS = {
    "front": ["........", "h..H..h.", ".H..h..H", "H.h..H.."],
    "right": ["........", "..h...H.", "H...h...", "..H...h.", ".h..H...", "...h...H"],
    "left": ["........", ".H...h..", "...h...H", ".h...H..", "...H..h.", "H...h..."],
    "back": ["........", ".h..H...", "...h..H.", "H....h..", "..H...h.", ".h..H...", "...h..H."],
}
head = faces(0, 0, 8, 8, 8)
for name in ("top", "back", "right", "left"):
    grain(*head[name], HAIR, HAIR_LIT, HAIR_DARK, seed=len(name))
fill(*head["bottom"], SKIN_SHADE)
fx, fy, _, _ = head["front"]
for y, row in enumerate(FACE):
    for x, key in enumerate(row):
        put(fx + x, fy + y, INK[key])
for name, flip in (("right", False), ("left", True)):
    sx, sy, _, _ = head[name]
    for k in range(8):                   # k = 0 es la columna que toca la cara
        x = sx + (7 - k if not flip else k)
        for y in range(HAIR_SIDE[k], 8):
            colour = SKIN
            if y == 4 and k < 3:
                colour = RIM               # la patilla de los lentes
            elif y in (4, 5) and k in (3, 4):
                colour = SKIN_LIT          # la oreja
            elif y == 6 and k < 3:
                colour = STUBBLE
            elif y == 7:
                colour = STUBBLE if k < 3 else SKIN_SHADE
            put(x, sy + y, colour)
bx, by, _, _ = head["back"]
fill(bx, by + HAIR_BACK, 8, 8 - HAIR_BACK, SKIN_SHADE)

# Un mechón solo sale donde debajo hay pelo, o cuelga un píxel desde él en el
# flequillo: suelto sobre la piel era una mancha en el cuello.
hat = faces(32, 0, 8, 8, 8)
hairy = {HAIR + (255,), HAIR_LIT + (255,), HAIR_DARK + (255,)}
for name, rows in TUFTS.items():
    x0, y0, _, _ = hat[name]
    bx0, by0, _, _ = head[name]
    for y, row in enumerate(rows):
        for x, key in enumerate(row):
            under = px[bx0 + x, by0 + y] in hairy
            above = name == "front" and y > 0 and px[bx0 + x, by0 + y - 1] in hairy
            if key != "." and (under or above):
                put(x0 + x, y0 + y, INK[key])

# ---------- polerón ----------
# De cuello redondo: sin capucha, sin cierre y sin bolsillo. La tela va en la
# capa de dentro; el cuello y el elástico de abajo, en la de fuera, para que
# sobresalgan como una costura de verdad.
body = faces(16, 16, 8, 12, 4)
for name in ("front", "back", "right", "left", "top"):
    grain(*body[name], OLIVE, OLIVE_LIT, OLIVE_DARK, seed=len(name) + 2)
fill(*body["bottom"], OLIVE_DEEP)
tx, ty, _, _ = body["front"]
put(tx + 3, ty, SKIN_SHADE)
put(tx + 4, ty, SKIN_SHADE)
jacket = faces(16, 32, 8, 12, 4)
for name in ("front", "back", "right", "left"):
    x0, y0, w, h = jacket[name]
    fill(x0, y0 + h - 2, w, 2, OLIVE_DEEP)        # elástico de abajo
    for x in range(w):                              # canalé: una raya sí, una no
        if x % 2 == 0:
            put(x0 + x, y0 + h - 2, OLIVE_DARK)
    fill(x0, y0, w, 1, OLIVE_DEEP)                 # cuello
jfx, jfy, _, _ = jacket["front"]
for x in (3, 4):                                    # el escote, abierto
    px[jfx + x, jfy] = (0, 0, 0, 0)
for x in (2, 5):
    put(jfx + x, jfy + 1, OLIVE_DEEP)
tjx, tjy, tw, td = jacket["top"]
for y in range(td):
    for x in range(tw):
        if not (2 <= x <= 5 and 1 <= y <= 2):
            put(tjx + x, tjy + y, OLIVE_DARK)

# ---------- mangas ----------
for origin, outer_origin, seed in (((40, 16), (40, 32), 1), ((32, 48), (48, 48), 2)):
    arm = faces(origin[0], origin[1], 4, 12, 4)
    over = faces(outer_origin[0], outer_origin[1], 4, 12, 4)
    for name in ("front", "back", "right", "left"):
        x0, y0, w, h = arm[name]
        grain(x0, y0, w, 10, OLIVE, OLIVE_LIT, OLIVE_DARK, seed=seed + len(name))
        fill(x0, y0 + 10, w, 2, SKIN)              # mano
        ox, oy, _, _ = over[name]                  # puño, por fuera
        fill(ox, oy + 8, w, 2, OLIVE_DEEP)
        for x in range(w):
            if x % 2 == 0:
                put(ox + x, oy + 8, OLIVE_DARK)
    grain(*arm["top"], OLIVE, OLIVE_LIT, OLIVE_DARK, seed=seed)
    fill(*arm["bottom"], SKIN_SHADE)

# ---------- cargo ----------
# La tela, dentro. Fuera, lo que abulta: el bolsillo del costado con su tapa,
# la pretina y el bajo, que cae sobre la zapatilla.
for origin, outer_origin, outer, seed in (((0, 16), (0, 32), "right", 3), ((16, 48), (0, 48), "left", 4)):
    leg = faces(origin[0], origin[1], 4, 12, 4)
    over = faces(outer_origin[0], outer_origin[1], 4, 12, 4)
    for name in ("front", "back", "right", "left"):
        x0, y0, w, h = leg[name]
        grain(x0, y0, w, 10, BROWN, BROWN_LIT, BROWN_DARK, seed=seed + len(name))
        fill(x0, y0 + 10, w, 1, SHOE)
        fill(x0, y0 + 11, w, 1, SOLE)
        ox, oy, _, _ = over[name]
        fill(ox, oy, w, 1, BROWN_DEEP)             # pretina
        fill(ox, oy + 9, w, 1, BROWN_DARK)         # bajo
    fill(*leg["top"], BROWN_DARK)
    fill(*leg["bottom"], SOLE)
    px0, py0, _, _ = over[outer]                   # bolsillo del costado
    fill(px0, py0 + 3, 4, 1, BROWN_LIT)            # tapa
    fill(px0, py0 + 4, 4, 4, BROWN)
    for y in range(4, 8):
        put(px0, py0 + y, BROWN_DARK)
        put(px0 + 3, py0 + y, BROWN_DARK)
    fill(px0, py0 + 7, 4, 1, BROWN_DEEP)
    put(px0 + 1, py0 + 4, BROWN_DEEP)              # botón
    # el bolsillo da la vuelta un píxel hacia delante y hacia atrás
    fx0, fy0, _, _ = over["front"]
    bx0, by0, _, _ = over["back"]
    edge_front = 0 if outer == "right" else 3
    edge_back = 3 if outer == "right" else 0
    for y in range(3, 8):
        put(fx0 + edge_front, fy0 + y, BROWN_LIT if y == 3 else BROWN_DARK)
        put(bx0 + edge_back, by0 + y, BROWN_LIT if y == 3 else BROWN_DARK)

# Dos píxeles sueltos en una esquina libre: el color de la pupila y el del
# párpado, que el rig usa para los ojos móviles.
put(0, 0, IRIS)
put(1, 0, SKIN)
# El collar con la luna y el parche del pecho, como en la foto.
SILVER, MOON, PATCH = (188, 190, 196), (236, 236, 240), (92, 104, 38)
for x, y in ((2, 1), (5, 1), (3, 2), (4, 2)):
    put(20 + x, 36 + y, SILVER)
put(20 + 3, 36 + 3, MOON)
put(20 + 5, 20 + 4, PATCH)
put(20 + 6, 20 + 4, PATCH)
img.save(OUT)

if AVATAR:
    face = img.crop((8, 8, 16, 16)).convert("RGBA")
    face.alpha_composite(img.crop((40, 8, 48, 16)))
    for x in (2, 5):
        face.putpixel((x, 5), IRIS + (255,))
    face.resize((512, 512), Image.NEAREST).save(AVATAR)
