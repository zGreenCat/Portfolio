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
| `peek_wave` | 32 | rejilla 8×4 | 506 KB | — | — | — |
| `peek_wave@half` | 32 | rejilla 8×4 | 286 KB | — | — | — |
| `peek_watch` | 64 | rejilla 8×8 | 495 KB | — | — | — |
| `run` | 16 | tira | 188 KB | 408 | 540 | 232 |
| `walk` | 25 | tira | 219 KB | 408 | 540 | 232 |
| `idle` | 16 | tira | 101 KB | 408 | 540 | 232 |
| `throw` | 19 | tira | 182 KB | 408 | 540 | 232 |
| `climb` | 32 | tira | 260 KB | 408 | 540 | 232 |
| `cheer` | 16 | tira | 183 KB | 408 | 540 | 232 |
| `type` | 16 | tira | 127 KB | 408 | 540 | 232 |
| `sit` | 31 | tira | 253 KB | 408 | 540 | 232 |

Cada hoja de perfil tiene además su `@half` (celda de 230×300), que es la que
se sirve salvo en pantallas grandes. Se genera de la entera:
`magick public/sprites/<hoja>.webp -filter Lanczos -resize 50% -quality 90
"public/sprites/<hoja>@half.webp"`. `npm test` falla si falta o no mide la
mitad exacta.

- `charHeight` — alto del personaje de pie dentro de la celda de 600
- `footY` — fila del suelo. En `sit` los pies cuelgan por debajo
- `centerX` — su eje horizontal dentro de la celda

**Las cinco de perfil salen del mismo rig, con una sola cámara**, así que
comparten geometría, tono y escala. Antes venían cada una de un render de
Mine-imator con su cámara: `charHeight` variaba entre 367 y 404 y el componente
ampliaba unas respecto a otras. Las poses siguen siendo las de aquellas hojas,
calcadas; ver *Cómo se mueve el personaje*.

`throw` suelta la perla en el **frame 15** contando desde cero, con la mano en
(394, 278) de la celda. Eso está en `THROW_RELEASE` y de ahí sale el punto de
salida de la perla. Lo mide el rig con su sonda `probe`.

**`peek_wave` es otra cosa:** de frente y en perspectiva, celda de 960×570. El
personaje sube por el borde de abajo, saluda con las dos manos y baja. Va a
1,5× para no ampliarse en pantallas grandes —70 MB descomprimida— y por debajo
de 900 px de ancho se sirve `@half`, que son 18 MB. El borde inferior de la
celda es el de la pantalla: `.greeter` va centrado y pegado abajo.

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

**`b2` tiene una quinta capa, `b2_stage`:** el escenario del podio, solo, sin
suelo debajo. No sale de Mine-imator sino de `scripts/render/world.py`, con la
misma cámara, y va anclada en una sola copia. Su PNG está con los demás en la
carpeta de renders para que la importación lo recorte igual que al resto.

`b5` no se tesela: repetir un acantilado daría un cantil detrás de otro. Va
anclado con `CLIFF_EDGE = 2371/3840`, la última columna con suelo. El `far` de
`b3` tampoco: es un templo, y los edificios no se repiten cada 300 metros.

**`b5_far` estuvo desfasado.** Se renderizó antes de bajar el terreno de `b5`,
con el suelo 79 px más arriba, y la importación lo compensaba con un caso
especial. Ya no: el PNG fuente se bajó esos 79 px (el original queda al lado
como `b5_far.antes-de-bajar-79.png`) y se importa como los demás. La capa
resultante es idéntica píxel a píxel a la que había. Si se vuelve a renderizar
desde Mine-imator con el terreno actual, entra tal cual.

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

`skin.png` 64×64 (la escribe `scripts/render/gen_skin.py`, junto con `avatar.png`) · `cv-vicente-araya.pdf` · `og.jpg` 1200×630 ·
`sounds/` button, throw, teleport (24 KB los tres) ·
`textures/` chest_closed, chest_open, ender_pearl

---

## Pendientes

### 1 · La niebla nunca salió

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

### 2 · `layer_front` — opcional

Una capa por delante del personaje, para que pase por detrás de un tronco.
Nunca ha hecho falta.

### Cerrados

- **`peek_wave` ya no se amplía.** Se mostraba a 1,87× en una pantalla de 1440.
  El saludo se rehízo de frente con el rig, a 1,5×, con una variante a la mitad
  para pantallas pequeñas. La hoja a mano se asomaba por la izquierda con un
  brazo; de ella se conserva el ritmo.
- **Las cinco hojas de perfil comparten cámara.** Era el motivo del reescalado
  entre hojas y de que el blanco no coincidiera.
- **`sit` se rehízo, con Blender por script.** La hoja de Mine-imator rotaba el
  cuerpo en bloque y leía como caerse de espaldas. La nueva baja la pelvis en
  vertical, lleva los muslos a 90° y deja las espinillas colgando con un
  balanceo que se amortigua; los últimos pasos cambian 0,6° por frame, así que
  la pose se asienta. Mira al sitio al bajar, a la pantalla al caer y termina
  con la cabeza levantada hacia el cielo. Ver *Herramientas*.
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

## Cómo se mueve el personaje

Leer antes de animar nada con `scripts/render/`. Sale de calcar con
`fit_pose.py` las hojas hechas a mano en Mine-imator, que son la referencia de
estilo. Las primeras animaciones escritas por fórmula, sin mirar esto, salieron
raras: cerradas sobre sí mismas, «como pose fetal».

**Tres cosas que hace la animación a mano y la fórmula no hacía:**

- **Gira el tronco entero**, no solo el pecho. En la corrida son ±40° entre
  cadera y pecho sumados. Con ese giro los hombros se separan en pantalla y los
  brazos se abren sin tocarlos.
- **Los brazos salen hacia fuera** del cuerpo, además de ir adelante y atrás.
  Sin ese eje se quedan pegados al tronco por mucho que se balanceen.
- **La cabeza contragira** lo mismo que gira el tronco, para seguir de perfil.

**Rangos medidos en `run`** (`poses/run.json`, grados):

| Articulación | Rango |
|---|---|
| Tronco, inclinación adelante | 25, fija |
| Tronco, giro (cadera + pecho) | −38 a 40 |
| Cabeza, contragiro | −46 a 38 |
| Brazo, adelante y atrás | −63 a 49 |
| Brazo, hacia fuera | hasta 58 el cercano, 72 el lejano |
| Codo | 8 a 80: casi recto atrás, doblado delante |
| Muslo | −64 a 58 |
| Rodilla | hasta 137 en la pierna que recoge |
| Cadera, sube y baja | 2,7 píxeles de skin |

**`throw` es lo contrario: casi no usa el tronco** (`poses/throw.json`). Se
inclina entre −6 y 2 y gira 12 como mucho; todo el gesto lo lleva el brazo, que
recorre 282° por encima de la cabeza. Dos cosas más que explican que se sienta
rígido: el brazo tarda seis frames en moverse 58° y luego salta 100° en uno, y
tras soltar vuelve de −282 a 0 en un solo frame, sin acompañar. Lo que le falta
es justo lo que `run` hace bien: cargar con el tronco y dejar que el giro abra
los hombros.

**Eso es lo que hace `poses/throw_v2.json`**, y es el patrón para cualquier
gesto nuevo: se calca la hoja hecha a mano, se mide contra `run` qué le falta
y se cambia solo eso. El tronco se arquea 15° atrás al cargar y se dobla 21°
al soltar, los hombros giran de −32° a 22°, el brazo alarga cada paso hasta la
suelta y acompaña tres frames después. Mano al soltar: (394, 278), índice 15.

**`walk` e `idle` también están calcadas** (`poses/walk.json`, `poses/idle.json`).
En `walk` las piernas y la altura salen del ajuste, pero hombros, brazos y
cabeza no: el ajuste dejó los hombros girados siempre hacia el mismo lado y
ladeó la cabeza 52° hacia la cámara. Esos tres salen de los keyframes del
proyecto original de Mine-imator: hombros 15° a cada lado, brazos 35° opuestos
a su pierna, codo de 18 a 22. **Los `.miproject` originales no están en el
repo**, que es público; viven fuera, y traen el ángulo exacto de cada pieza en
cada keyframe. Son la primera fuente cuando un calco no convence.

**El tronco es una sola pieza.** Va cortado en doce rebanadas y cada una toma
una parte creciente del giro del pecho. Con dos cajas rígidas unidas por una
bisagra se veía un escalón entre cadera y pecho en cuanto giraba.

**Las hojas no están a la misma escala.** `run` está renderizada un 4,9% más
grande de lo que el sitio supone al escalarla; `throw`, un 0,4% más pequeña. El
ajuste lo mide en el primer frame y lo guarda como `zoom`.

**Calcar no es animar.** El ajuste copia poses que existen. Un gesto nuevo
parte de estas como vocabulario, pero el ritmo y los arcos hay que decidirlos y
mirarlos en movimiento.

**Límite conocido del ajuste:** busca cerca de la pose anterior. Un brazo que da
media vuelta entre dos frames, como al lanzar, se pierde y acaba escondido
contra el cuerpo, que cuesta poco porque los dos son oscuros. Por eso barre los
brazos en redondo al empezar cada frame.

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

**La cabeza sí puede girar.** En `sit` gira 38° hacia la pantalla al caer y
vuelve al perfil. El cuerpo no se mueve del perfil, y el frame 1 tampoco, así
que la hoja sigue alineando contra `idle`.

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
- **`scripts/render/render_all.sh`** — rehace las trece hojas del personaje y
  sus `@half` desde `public/skin.png`. La última, `duo`, es el avatar de la
  portada: imprime la medida de su celda, que hay que copiar a `coverSheet.ts`
  si cambia. Es lo que hay que lanzar tras tocar la
  skin (`gen_skin.py`) o el rig. Lo de abajo explica cada pieza.
- **`scripts/render/`** — Blender sin ventana. `rig.py` monta la skin como
  cajas con sus articulaciones, una cámara ortográfica de verdad y renderiza
  una lista de poses; `gen_sit.py` escribe esa lista. De aquí sale `sit`. Las
  poses son números, así que un ajuste es cambiar una cifra y volver a lanzar:

  ```bash
  python3 scripts/render/gen_sit.py /tmp/sit.json
  blender -b -P scripts/render/rig.py -- public/skin.png /tmp/sit.json /tmp/out 540
  magick /tmp/out/f*.png +append -quality 90 public/sprites/sit.webp
  ```

  El `540` es el `footY` de la hoja. En los ángulos, positivo es siempre hacia
  delante: un brazo avanza, el torso se inclina, la cabeza mira abajo.

  `fit_pose.py` hace el camino inverso: recibe los frames de una hoja que ya
  existe y mueve las articulaciones hasta que el render coincide. Lo que saca
  va a `scripts/render/poses/<hoja>.json`, que `rig.py` renderiza tal cual. Son
  unos tres minutos de gráfica por frame. Ver *Cómo se mueve el personaje*.

  `gen_throw.py` es el primer gesto hecho así: lee el calco del lanzamiento
  (`poses/throw.json`), conserva pies, paso y ritmo, y reescribe tronco y
  brazo. Su salida es `poses/throw_v2.json`, que es la hoja `throw` del sitio.
  `gen_peek.py` escribe el saludo; toma su ritmo del saludo hecho a mano.
  `gen_watch.py` escribe `peek_watch`, el que mira la imagen en el visor:
  misma cámara que el saludo, a 0,8× (celda de 512×384; son 50 MB
  descomprimida). Cuatro tramos seguidos —entrada, reposo, señalar, pensar—
  que la página encadena. Se monta en rejilla:

  ```bash
  python3 scripts/render/gen_watch.py /tmp/watch.json 0.8
  blender -b -P scripts/render/rig.py -- public/skin.png /tmp/watch.json /tmp/out
  magick montage /tmp/out/f*.png -tile 8x8 -geometry 512x384+0+0 -background none /tmp/watch.png
  magick /tmp/watch.png -quality 90 public/sprites/peek_watch.webp
  ```

  `gen_type.py` escribe `type`, el personaje tecleando en el chat: toma los
  dieciséis frames de `poses/idle.json` y les cambia brazos y cabeza, así que
  pies y balanceo son los del reposo y pasar de una a otra no lo mueve.
  `gen_podium.py` escribe `climb` y `cheer`, y la medalla es una pieza del
  rig que una pose enseña con `"medal": 1`.

  **`world.py` renderiza capas de mundo** desde una lista de bloques, con las
  texturas del juego y la cámara de arriba: 133 px por bloque y la superficie
  en la fila que se le pida. `gen_podium_world.py` escribe la escena del
  escenario. Las texturas no están en el repo.

  **`props.py` renderiza lo plantado que no es un bloque**, con la cámara y
  la luz de `world.py`: el cofre (`chest`, cerrado y abierto, modelo de
  14×14×14 con tapa y pestillo sobre `entity/chest/normal.png`), el cartel
  (`sign`, tabla y poste sobre `block/oak_sign.png`) y la farola (`lamp`: base de piedra,
  poste, travesaño y dos faroles colgantes del juego). Escribe PNG recortados
  al mismo ancho y al mismo pie; de ahí salen `public/textures/chest_*.webp`,
  `sign.webp` y `lamp.webp`, sin pérdida.

  La farola lleva cuatro texturas y `props.py` solo admite una, así que se le
  da una hoja de 64×64 con ellas en fila; el comando está en la cabecera del
  script.

  ```bash
  blender -b -P scripts/render/props.py -- sign <texturas>/oak_sign.png /tmp/out
  magick /tmp/out/sign.png -define webp:lossless=true public/textures/sign.webp
  ```

  Las hojas del sitio se renderizan todas con `zoom` 1, no con el que trae
  cada calco: ese valor solo servía para casar con la hoja original.

  **El tono ya está igualado.** Mine-imator ilumina la skin algo más clara y
  azulada, y el rig lo reproduce con `TINT`: blanco 240/241/247 frente a
  241/242/248 de `idle`, `walk` y `throw`. `run` va aparte desde siempre
  (244/248/251).
- **Blockbench + Blender** — mejor acabado, más trabajo.
- **Amulet / MCEdit** — para exportar una región del mundo propio e importarla,
  en vez de construir el terreno a mano.
- **Replay Mod + shaders** — solo para fondos de escena completa. No sirve para
  sprites con alfa: captura el mundo entero y no recorta al personaje.
