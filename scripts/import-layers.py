"""
Importa los renders del mundo a public/layers.

Recorta el vacío de cada capa por arriba y todas por la misma fila por abajo,
codifica a WebP y genera las variantes a media resolución. Escribe además el
manifiesto de alturas que el código necesita para escalar cada capa.

El recorte inferior es común a todas: vienen de la misma escena y la misma
cámara, así que una fila del render es la misma posición en pantalla para
cualquier capa. Recortar cada una por su cuenta las descuadraría.
"""
import json, os, sys
from PIL import Image

SRC = "/home/zgreencat/videos-portofolio/world"
OUT = "public/layers"
BIOMES = {"b1": ["far","mid","near","ground"], "b2": ["far","mid","near","ground"],
          "b3": ["far","mid","near","ground"], "b4": ["far","mid","near","ground"],
          "b5": ["far","ground"]}

BLOCK = 133          # px por bloque, medido por autocorrelación
BELOW = 151          # px de terreno que se conservan por debajo de la superficie
QUALITY = 82

# El recorte inferior se calcula por bioma, a partir de su superficie medida.
# Así el personaje queda siempre a la misma altura sobre el borde de la capa y
# la línea del suelo no da un escalón al cruzar de bioma, aunque cada escena se
# haya construido a una altura distinta.

def surface_row(path):
    """Fila donde la cobertura opaca salta al 98%: el borde real del terreno.

    No vale buscar la primera fila opaca por columna — la hierba alta crece
    pegada al suelo, así que la columna sigue siendo opaca a través de la brizna
    y el barrido se para en la punta, no en la tierra.
    """
    import numpy as np
    al = np.asarray(Image.open(path).convert("RGBA"))[:, :, 3]
    op = al > 40
    has = op[-1, :]
    cov = op[:, has].sum(axis=1) / has.sum()
    return int(np.argmax(cov >= 0.98))


def content_top(im):
    a = im.getchannel("A")
    w, h = im.size
    px = a.load()
    for y in range(h):
        if any(px[x, y] > 10 for x in range(0, w, 3)):
            return y
    return 0

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {}
    surfaces = {}
    for biome, kinds in BIOMES.items():
        surface = surface_row(f"{SRC}/{biome}/{biome}_ground.png")
        bottom = surface + BELOW
        surfaces[biome] = {"surface": surface, "bottom": bottom}
        print(f"{biome}: superficie {surface}, recorte inferior {bottom}")
        for kind in kinds:
            src = f"{SRC}/{biome}/{biome}_{kind}.png"
            im = Image.open(src).convert("RGBA")
            top = content_top(im)
            # Margen de un bloque por si el alfa del borde se pierde al codificar.
            top = max(0, top - 8)
            cropped = im.crop((0, top, im.width, bottom))
            name = f"{biome}_{kind}"
            cropped.save(f"{OUT}/{name}.webp", "WEBP", quality=QUALITY, method=6)
            half = cropped.resize((cropped.width // 2, cropped.height // 2), Image.LANCZOS)
            half.save(f"{OUT}/{name}@half.webp", "WEBP", quality=QUALITY, method=6)
            manifest[name] = cropped.height
            kb = os.path.getsize(f"{OUT}/{name}.webp") // 1024
            print(f"  {name:<12} recorte {top:>5}..{bottom}  alto {cropped.height:>5}  {kb:>4} KB")
    with open("src/content/layers.json", "w") as f:
        json.dump({"block": BLOCK, "below": BELOW, "biomes": surfaces, "heights": manifest}, f, indent=2)
    print(f"\nmanifiesto: src/content/layers.json ({len(manifest)} capas)")

main()
