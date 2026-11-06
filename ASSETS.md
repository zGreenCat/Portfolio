# ASSETS.md

Producción de assets del portfolio. Todo lo de aquí se hace fuera del código:
mientras no exista, el desarrollo avanza con marcadores de posición.

Cómo funciona el sitio: **[README.md](./README.md)**.
La arquitectura por dentro: **[CLAUDE.md](./CLAUDE.md)**.

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
| `sit` | 31 | tira | 207 KB | 411 | 556 | 232 |

- `charHeight` — alto del personaje dentro de la celda de 600
- `footY` — fila del pie de apoyo, **mediana del ciclo**, no el frame más bajo
- `centerX` — su eje horizontal dentro de la celda

**Las cinco se renderizaron con cámaras distintas**, de ahí que `charHeight`
varíe entre 367 y 404. El componente lo compensa, pero eso significa ampliar
unas respecto a otras. Si algún día se re-exportan todas con la misma cámara,
desaparece el reescalado y ganan nitidez.

`throw` suelta la perla en el **frame 15**, con la mano en (362, 240) de la
celda. Eso está en `THROW_RELEASE` y de ahí sale el punto de salida de la perla.

**El frame 1 de `sit` es el personaje DE PIE**, y es lo que permite alinear la
hoja: su `centerX` sale 232, idéntico al de `idle`. Sin ese frame habría que
estimar cuánto se desplaza el cuerpo al sentarse, que es justo lo que cambia.
Repetir el truco en cualquier hoja futura ahorra varias vueltas.

### Capas de mundo

Se renderizan **todas al mismo lienzo, 3840×3000**, y el código las recorta. Ver
*Tubería de importación* más abajo.

| Bioma | | capas | superficie | alto tras recortar | MB descomp. |
|---|---|---|---|---|---|
| b1 | bosque | far mid near ground | 2791 | 2091 · 1562 · 1066 · 1014 | 88 |
| b2 | taiga | far mid near ground | 2811 | 2020 · 2002 · 1598 · 945 | 101 |
| b3 | desierto | far mid near ground | 2842 | 1729 · 1037 · 666 · 548 | 61 |
| b4 | cerezos | far mid near ground | 2842 | 1719 · 1570 · 1690 · 1587 | 101 |
| b5 | acantilado | far ground | 2837 | 1100 · 1587 | 41 |

18 capas más sus 18 variantes a media resolución: **10 MB en WebP**. La columna
de MB es lo que ocupan descomprimidas, que es el límite real en móvil — no el
peso del archivo.

`b5` no se tesela: repetir un acantilado daría un cantil detrás de otro. Va
anclado con `CLIFF_EDGE = 2371/3840`, la última columna con suelo. El `far` de
`b3` tampoco: es un templo, y los edificios no se repiten cada 300 metros.

**`b5_far` está desfasado.** Se renderizó antes de que bajaras el terreno de
`b5`, así que su escena tiene el suelo 79 px más arriba. La importación lo
compensa recortándolo por su propia línea en vez de por la del bioma, con un
`QUITAR EN CUANTO SE RE-RENDERICE` marcado en el script.

### Tubería de importación

`scripts/import-layers.py` recorta, codifica y genera el manifiesto. Se ejecuta
cada vez que llegan renders nuevos:

```bash
python3 scripts/import-layers.py
```

Qué hace, y por qué:

- **Recorta el vacío por arriba**, hasta donde empieza el contenido. Una capa
  sin árboles no arrastra el cielo que había sobre ellos: `b3_ground` pasó de
  3000 px a 548.
- **Recorta por abajo a 151 px bajo la superficie del bioma**, la misma
  distancia en todos. Por eso el personaje queda siempre a la misma altura y
  cruzar de bioma no da un escalón, aunque cada escena se construyera a una
  altura distinta.
- **Mide la superficie** buscando la fila donde la cobertura opaca salta al 98%.
  No vale buscar el primer píxel opaco por columna: la hierba alta crece pegada
  al suelo y el barrido se para en la punta de la brizna, no en la tierra. Ese
  error me hizo creer dos veces que `b5` no era plano.
- **Escribe `src/content/layers.ts`** con el alto de cada capa y las constantes.
  Ese archivo se genera: no editarlo a mano.

```
BLOCK_PX_SOURCE  133    px por bloque, medido por autocorrelación del suelo
GROUND_BELOW     151    px conservados bajo la superficie
WORLD_UNIT      1339    px de render que ocupa la caja del mundo en pantalla
```

`WORLD_UNIT` sale de conservar el encuadre original: la caja medía 1440 px de un
render a 143 px/bloque, o sea 10,07 bloques. A 133 px/bloque son 1339. Sin eso,
mapear los 3000 px del render a la misma caja dejaría el mundo a menos de la
mitad de tamaño.

**Cómo verificar una escala:** autocorrelación horizontal de una banda bajo la
superficie. Una serie limpia de armónicos (133·265·398·531) es la rejilla; un
pico suelto suele ser un patrón decorativo. Así se detectó que `b4` venía a 195
px/bloque, un 47% más grande que el resto.

### Otros

`skin.png` 64×64 · `cv-vicente-araya.pdf` · `og.jpg` 1200×630 ·
`sounds/` button, throw, teleport (24 KB los tres) ·
`textures/` chest_closed, chest_open, ender_pearl

---

## Pendientes

### 1 · `sit` — el gesto hay que rehacerlo

La hoja está montada y alineada, pero **el cuerpo rota como un bloque**: cabeza,
torso y piernas giran a la vez alrededor de un punto, y acaba a 45° con las
piernas hacia arriba. Lee como caerse de espaldas, no como sentarse.

Sentarse es casi lo contrario — casi nada rota en bloque:

| Parte | Qué hace |
|---|---|
| Pelvis | Baja **en vertical** hasta el asiento y se para. No rota |
| Muslos | Rotan ~90° en la cadera, hacia delante |
| Rodillas | Se doblan; las espinillas cuelgan |
| Torso | Casi vertical, como mucho 10-15° atrás |
| Cabeza | Nivelada, mirando al horizonte |

Dos cosas más: **en los frames 6-16 se le ven los dos ojos** —se gira a cámara,
y eso rompe el perfil puro—, y **los últimos frames no frenan**, así que la pose
final se corta a media inercia en vez de asentarse.

Lo que sí hay que conservar: el **frame 1 de pie**, que es lo que alinea la hoja.

### 2 · `peek_wave` — decisión pendiente

```
viewport 1080  →  celda de 600 px mostrada a  842  = 1.40×
viewport 1440  →                        a 1123  = 1.87×
```

Es lo primero que se ve y se amplía casi al doble en pantallas grandes. Pero
re-renderizarla al doble son 6960×4800 = 134 MB descomprimidos, y está en la
precarga que bloquea la pantalla de carga.

Tres salidas: bajar `PEEK_CELL_VH` y mostrarla a 1:1 —el saludo se ve más
pequeño—, renderizar a 1,5× y comer 75 MB, o pasarla a vídeo con alfa.

### 3 · `b5_far` — desfasado

Ver *Capas de mundo*. Va compensado en la importación; el parche se quita
cuando se re-renderice.

### 4 · Captura de Postea

Único proyecto sin imagen en el carrusel. Su diapositiva muestra «producto
interno · sin demo pública», que es cierto —es un SaaS de Shinsekai— así que no
corre prisa.

### 5 · La niebla nunca salió

Saturación relativa al suelo, medida sobre los renders actuales:

```
        far    mid   near      objetivo ~0.25 / 0.50 / 0.75
b1     0.73   0.97   0.80
b2     0.97   1.08   0.83
b3     0.78   0.78   0.91
b4     1.00   1.14   0.99
```

`mid` sale igual o más saturada que el suelo en tres de los cuatro, lo cual es
imposible con profundidad real. **Importa menos de lo que parece**: la niebla la
pone el CSS y solo en nieve y desierto, por decisión tomada. Solo volvería a
importar si algún día se quiere recuperar la sensación de fondo lejano que daba
el render original.

En proyección ortográfica una colina lejana se dibuja **del mismo tamaño** que
una cercana. Lo único que las separa es la niebla. Por eso una `far` sin niebla
no se lee como fondo: se lee como un muro.

### 6 · `layer_front` — opcional

Una capa por delante del personaje, para que pase por detrás de un tronco.
Nunca ha hecho falta.

### Cerrados

- **`b4_far` ya es propio.** Era la `far` de `b1` teñida; ahora difieren en 47
  de media.
- **La banda de paso de `b5` es plana.** La cobertura salta al 99% en una sola
  fila. Lo medí mal dos veces por culpa de la hierba alta.
- **`b5` no tiene agujeros.** Cero columnas sin suelo dentro del terreno.
- **El empalme de `run` está bien.** Salta 9,46 contra una media de 7,39, y
  **no es el mayor salto de su propio ciclo** —el paso 3→4 salta 10,89—. Quitar
  cualquier frame lo empeora. El documento decía «60% más» y era falso.
- **Árboles cortados.** Ninguna capa toca la fila 0.

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
lienzo        3840 × 3000  ← igual para TODOS los biomas
1 bloque      133 px
```

**El lienzo es el mismo para los cinco.** Al cambiar su alto se mueven los px
por bloque, así que si cada bioma fuera a una altura distinta habría que
recalibrar la cámara en cada uno. Que sobre aire no cuesta nada: la importación
recorta lo que no se usa.

Los 3000 px salen del árbol más alto del mundo, una pícea de `b2` de 15,3
bloques, más margen. Si alguna vez entra algo más alto, hay que subirlo — y
entonces **recalibrar la cámara una vez** hasta que un bloque vuelva a medir
133 px.

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

El lienzo captura ~22 bloques de alto; en pantalla se ven **10,07**, que es el
encuadre original y lo que fija `WORLD_UNIT`. El resto sobresale por arriba: ahí
es donde caben las copas, y por eso en vertical ya no se cortan.

El suelo por donde camina, **plano**. Ya no hace falta que esté a la misma
altura entre biomas —la importación lo normaliza recortando a una distancia fija
bajo cada superficie— pero sí tiene que ser plano **dentro** de cada uno:
`surfaceY` es un solo número por bioma.

### Verificación antes de renderizar los 18

Incluye la pasada `ref` —solo el personaje, donde va a estar—. **Mido su altura
y la comparo con las hojas**: si coincide, la cámara está calibrada y todo casa.
La última vez dio 271 px, y de ahí salen `CHAR_HEIGHT_VH` y `FEET_BELOW_SURFACE`.

Y renderiza **un bioma completo primero**. Descubrir que el sol estaba girado, o
que el zoom se movió, después de catorce capas es repetirlo todo.

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

### Los biomas se recortan, no se funden ni se empalman

Cada bioma ocupa su territorio y se corta en la frontera. **Esto reemplazó al
fundido por opacidad**, que se probó y falló por dos motivos: mostraba los dos
terrenos a la vez —cactus sobre cerezos— y dejaba pasar el cielo, porque dos
capas al 50% componen un 75% y no un 100%.

Para producción significa lo mismo que antes: **no hay que empalmar el terreno
de un bioma con el del siguiente**. La frontera es un corte vertical limpio, y
en el juego los biomas también cambian de golpe.

Lo único que sí importa es que **la franja por donde camina el personaje sea
plana** y esté a la altura declarada en `surfaceY`.

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

## Clima

Las partículas son de código, no de render: nieve en `b2`, tormenta de arena en
`b3`, pétalos en `b4`. Van en canvas por encima del terreno.

Lo que sí afecta a la producción:

**La tormenta de arena quita visibilidad al fondo.** El `far` de `b3` se atenúa
hasta un 60% en el pico de racha. Un fondo que solo se lea por su detalle fino
desaparece ahí; lo que aguanta es la **silueta**. El templo funciona porque es
una masa reconocible.

**Las rachas dejan claros.** La tormenta oscila entre el 45% y el 100% de fuerza,
así que el fondo asoma cada pocos segundos. No hace falta renderizar el `far` de
`b3` "para verse entre polvo": se renderiza normal y el polvo lo pone el código.

**Los cerezos no necesitan pétalos en el render.** Si el `b4` los trae pintados,
se suman a los del canvas y se ve cargado.

## Herramientas

- **Mine-imator** — rápido, alfa nativo. La opción por defecto.
- **Blockbench + Blender** — mejor acabado, más trabajo.
- **Amulet / MCEdit** — para exportar una región del mundo propio e importarla,
  en vez de construir el terreno a mano.
- **Replay Mod + shaders** — solo para fondos de escena completa. No sirve para
  sprites con alfa: captura el mundo entero y no recorta al personaje.
