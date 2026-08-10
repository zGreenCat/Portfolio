# ASSETS.md

Producción de assets del portfolio. Todo lo de aquí se hace fuera del código:
mientras no exista, el desarrollo avanza con marcadores de posición.

Cómo funciona el sitio: **[README.md](./README.md)**.

---

## Estado

### Hojas de sprites

Las cifras de geometría son medidas, no objetivos: las lee `Character.tsx`
para escalar y colocar cada hoja.

| Hoja | Frames | Montaje | Peso | charHeight | footY | centerX |
|---|---|---|---|---|---|---|
| `peek_wave` | 32 | rejilla 8×4 | 267 KB | — | — | — |
| `run` | 16 | tira | 80 KB | 367 | 512 | 230 |
| `walk` | 25 | tira | 91 KB | 399 | 526 | 242 |
| `idle` | 16 | tira | 45 KB | 404 | 548 | 232 |
| `throw` | 19 | tira | 86 KB | 400 | 523 | 190 |

- `charHeight` — alto del personaje dentro de la celda de 600
- `footY` — fila del pie de apoyo, **mediana del ciclo**, no el frame más bajo
- `centerX` — su eje horizontal dentro de la celda

**Las cinco se renderizaron con cámaras distintas**, de ahí que `charHeight`
varíe entre 367 y 404. El componente lo compensa, pero eso significa ampliar
unas respecto a otras. Si algún día se re-exportan todas con la misma cámara,
desaparece el reescalado y ganan nitidez.

`throw` suelta la perla en el **frame 15**, con la mano en (362, 240) de la
celda. Eso está en `THROW_RELEASE` y de ahí sale el punto de salida de la perla.

### Capas de mundo

| Bioma | | ground | near | mid | far | superficie |
|---|---|---|---|---|---|---|
| b1 | bosque | ✅ | ✅ | ✅ | ✅ | y=1278 |
| b2 | taiga | ✅ | ✅ | ✅ | ✅ | y=1267 |
| b3 | desierto | ✅ | ✅ | ✅ | ✅ | y=1278 |
| b4 | cerezos | ✅ | ✅ | ✅ | ⚠️ relleno | y=1278 |
| b5 | acantilado | ✅ | — | — | ✅ | y=1241 |

Todas 3840×1440, PNG con alfa, sin cielo. **5,5 MB en total** ya en WebP.

`surfaceY` es la fila donde está el suelo que se pisa, y **no tiene que ser la
misma en todos**: la taiga lleva nieve encima de la hierba y el acantilado está
más alto. El personaje sube y baja con el terreno durante el fundido.

`b5` es un caso aparte: no se tesela —repetir un acantilado daría un cantil
detrás de otro— y no lleva capas intermedias porque ahí ya no hay recorrido.
El `far` de `b3` tampoco se tesela: es un templo, y los edificios no se repiten
cada 300 metros.

### Otros

`skin.png` 64×64 · `cv-vicente-araya.pdf` · `og.jpg` 1200×630 ·
`sounds/` button, throw, teleport (24 KB los tres) ·
`textures/` chest_closed, chest_open, ender_pearl

---

## Pendientes

### 1 · `sit.png` — cierra el recorrido

Sentado en el borde del acantilado, mirando al horizonte. **Un solo frame fijo
basta para empezar**: a ese tamaño y con el cielo nocturno detrás, un balanceo
mínimo en CSS lo sostiene. Solo animarlo si se echa de menos.

Sin esto el final es el personaje de pie, que no cierra nada.

### 2 · El cierre de ciclo de `run`

`run2` está puesto temporalmente en el sitio de `run`. Tiene mejor pose, pero
**el empalme salta un 60% más que sus vecinos** (36,4 contra una media de 28,6),
así que da un enganchón por ciclo.

No es que repita un frame: es que se salta un trozo. Probar a exportar 17 y
quedarse con los 16 primeros, que es distinto a que el 17 repita al 1.

El `run` anterior de 14 frames cerraba bien y está en el historial.

### 3 · `b4_far` — el fondo de los cerezos

Ahora mismo es la `far` de `b1` teñida. Se sostiene de lejos pero conserva la
silueta de las montañas del bosque.

### 4 · Calidad de `peek_wave`

Dos problemas que los ajustes no tapan: la celda mide 600 px y **se muestra a
842 en una pantalla de 1080**, o sea que se amplía un 40%; y a 18 fps un gesto
en primer plano sigue viéndose algo escalonado.

Más frames y celda más grande a la vez se va a 25-30 megapíxeles, que son 100+
MB de memoria descomprimida. **Para este plano lo correcto es un vídeo, no una
hoja**: se reproduce una sola vez y no se rebobina con scroll, que era la única
razón para usar sprites.

Si se rehace: frames a 30 fps, celda ~650×900, y la codificación la hace el
código (WebM con alfa para Chrome y Firefox, HEVC para Safari).

### 5 · Niebla en `b1` y `b2`

`b3` tiene degradado atmosférico real: la saturación baja de 0,451 en el suelo
a 0,280 en la capa lejana, y el contraste a un tercio. En `b1` y `b2` las capas
lejanas salen casi con la misma saturación que el suelo, así que la distancia
no se lee y hay que compensarla con un filtro CSS.

Si se vuelve a pasar por esos biomas, subirles la niebla como en `b3`.

### 6 · `layer_front` — opcional

Dos o tres árboles del plano más cercano, dibujados **encima** del personaje.
Ahora `ground` lleva los árboles incrustados, así que el personaje solo puede ir
delante de todo o detrás de todo: nunca pasa por detrás de un tronco.

---

## Reglas de producción

- **Entrega PNG, no video.** La codificación a WebP la hace el código.
- **Fondo transparente.** Mine-imator: *Transparent background*. Es lo que más
  veces se ha olvidado.
- **Luz plana en el personaje.** Sin specular. La hora del día se aplica por
  CSS, y un brillo horneado deja la skin clavada a esa iluminación.
- **Sin cielo en las capas de mundo.** El cielo, las estrellas y el ciclo
  día-noche son CSS, y por eso el anochecer puede caer de forma progresiva en
  vez de aparecer con el bioma.
- **Recorta el canvas al contenido.** Cada píxel vacío se multiplica por el
  número de frames de la hoja.
- **Nada tocando el borde superior.** Deja margen para el brazo al subir.

### El cierre de un bucle

Lo que más veces ha fallado. **Un ciclo no se cierra repitiendo el primer frame
al final**: se cierra dejando el último un paso antes del primero.

```
mal                          bien
… 15 16(=1) | 1 2 …          … 15 16 | 1 2 …
      ↑ pose repetida                ↑ salto normal
      el ciclo se atasca
```

Comprobación: **el salto del empalme tiene que parecerse a los demás.** Ni 0
—repetido— ni el doble —falta un frame—.

Y un bucle no lleva curva de entrada ni de salida: velocidad constante de
principio a fin. En `walk` hubo que descartar dos frames porque frenaba al
final.

### Escalado

Los sprites se muestran reducidos, así que **`image-rendering: pixelated` no se
usa en ellos** — esa regla sirve para ampliar arte de 16×16. Sí se aplica a las
texturas de bloque, que sí se amplían.

---

## Cámara

**Una sola para todo el mundo.** Móntala una vez y no la toques.

```
proyección    ortográfica  (Mine-imator: FOV 7 + cámara muy alejada)
giro          lateral 90°
rotación X    0            ← perfil puro, sin inclinar
cámara Y      13
```

**El ángulo tiene que coincidir en todo. El zoom no.** Con proyección
ortográfica acercarse no deforma, solo escala: las hojas de personaje se
renderizan de cerca y las capas de mundo desde lejos, y el código las cuadra.

**Excepción — `peek_wave`**: perspectiva e inclinación libres. Ese plano no
está dentro del mundo, es el personaje asomándose hacia el usuario.

**FOV 7 no es ortográfica de verdad**, pero a esa distancia se comporta como
tal: el semiángulo es 3,5°, un 0,2% de variación de escala entre el centro y el
borde. Sobre 1440 px son 3 px.

### El truco de las pasadas

Monta el terreno y el personaje **en la misma escena** y renderiza ocultando lo
que no toca: personaje, `ground`, `near`, `mid`, `far`. Misma cámara, mismo
lienzo, misma luz — **las capas encajan solas** y no hay offsets que calcular.

Y un `ref` con solo el personaje, colocado donde va a estar. Cuesta un clic y
da la escala y la posición exactas: sin él hay que estimarlas, y estimarlas
costó varias vueltas.

### Encuadre

12-13 bloques de alto. Chequeo: **el personaje ocupa ~1/7 del alto del cuadro**.

El suelo por donde camina, **plano**, y a la misma altura de mundo en todos los
biomas salvo que haya un motivo (nieve, acantilado), en cuyo caso se apunta su
`surfaceY` y el código lo compensa.

---

## Decisiones cerradas

Están aquí para no volver a discutirlas. Si alguna se reabre, que sea con
información nueva, no por olvido.

### Pre-renderizado, no 3D en tiempo real

Se llegó a montar una prueba funcional en three.js: mundo voxel, la skin sobre
un rig y los ciclos aplicados como funciones continuas. **Descartado** por el
acabado: Mine-imator da oclusión, sombras y niebla que en tiempo real habría
que programar una por una.

Lo que se renunció a cambio: no hay parallax dentro de una capa, cada cambio es
re-renderizar, el largo del mundo depende del ancho de las capas, y cambiar de
skin obliga a rehacerlo todo.

### Perfil puro, 0°. La inclinación de 15° se probó y se descartó

Se llegó a re-exportar `run` a 15° y a montarlo. El motivo de revertir es
geométrico:

```
altura en pantalla = altura_del_terreno × 0,97 + profundidad × 0,26
```

Cada bloque de profundidad **sube 0,26 en pantalla**. Un horizonte necesita
mucha profundidad, y esa profundidad lo saca del encuadre: a 15° el presupuesto
de profundidad visible son ~25 bloques y no cabe un fondo.

**Los 15° cambian horizonte por caras superiores. No se pueden tener las dos.**

Lo que se acepta: sin caras superiores el brillo máximo se queda en ~0,68 y el
plano se lee algo apagado. Se compensa con oclusión ambiental, sombras
proyectadas y el grado de CSS.

### El suelo se renderiza, no se tesela en CSS

Se probó con teselas de 16×16. Más nítido, más ligero e infinito, pero **plano**
al lado de un personaje que es render 3D: el resultado parecía Terraria.

### Los biomas se funden, no se empalman

Los cinco cubren el mundo entero y se mezclan por opacidad. Evita tener que
hacer que el terreno de un bioma continúe en el siguiente, que es lo caro.
Funciona porque la franja donde camina es plana.

### El teselado es en espejo

Los renders no son teselables, así que se repiten alternando volteados: el
borde derecho de una copia toca siempre el borde derecho de la siguiente y
encajan por construcción. A cambio el paisaje se repite en espejo, cosa que no
se nota en terreno irregular — pero sí en un edificio, y por eso el templo va
anclado.

### Cielo, hora del día, estrellas, fuegos y UI van en CSS

No se renderizan. El cielo en degradado permite que la noche caiga de forma
progresiva y que el mismo terreno sirva para cualquier hora.

### El personaje no se gira hacia cámara

Se planteó para arreglar la silueta de `idle`, que de perfil puro se lee
estrecha. Descartado: desalinearía todas las hojas entre sí.

---

## Herramientas

- **Mine-imator** — rápido, alfa nativo. La opción por defecto.
- **Blockbench + Blender** — mejor acabado, más trabajo.
- **Amulet / MCEdit** — para exportar una región del mundo propio e importarla,
  en vez de construir el terreno a mano.
- **Replay Mod + shaders** — solo para fondos de escena completa. No sirve para
  sprites con alfa: captura el mundo entero y no recorta al personaje.
