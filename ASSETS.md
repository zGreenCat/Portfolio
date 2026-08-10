# ASSETS.md

Orden de trabajo para los assets del portfolio side-scroll.

Storyboard visual: https://claude.ai/code/artifact/0a574fc7-fe58-4934-9d63-1f9dbfb71e4b

Todo lo de aquí se produce fuera del código. Mientras no exista, el desarrollo avanza con maquetas, así que nada queda bloqueado esperando renders.

> **El mundo se renderiza**, con la misma cámara y la misma luz que el personaje. La maqueta con el suelo hecho de teselas CSS planas se descartó: el personaje es un render 3D con sombreado por cara, y el mundo eran rectángulos. No encajaban — parecía Terraria, no Minecraft.
>
> **Cámara en perfil puro, 0°.** Se probó a 15° y se revirtió. Ver *Decisiones cerradas*.

> **Tubería validada** con la prueba de `peek_wave`: render → PNG con alfa da 0,16% de píxeles semitransparentes, bordes duros, sin halo. Los límites técnicos de abajo salen de montar esa secuencia como sprite sheet real.

---

## Decisiones cerradas

Están aquí para no volver a discutirlas. Si alguna se reabre, que sea con información nueva, no por olvido.

### El mundo va pre-renderizado, no en 3D en tiempo real

Se llegó a montar una prueba funcional en three.js: mundo voxel, la skin sobre un rig, y los ciclos de `run` e `idle` aplicados como funciones continuas a partir de las tablas de ángulos.

**Descartado.** Lo que decidió: el acabado. Mine-imator da oclusión ambiental, sombras y niebla que en tiempo real habría que programar una por una, y el listón era "que se vea 100% Minecraft".

Lo que se renunció a cambio, y conviene tener presente:

| | |
|---|---|
| Parallax dentro de una capa | No existe. Se finge con varias capas a distinta velocidad |
| Iterar | Cada cambio es re-renderizar, no tocar un número |
| Largo del mundo | Acotado por el ancho de las capas; infinito solo si son teselables |
| Cambiar de skin | Re-renderizar todo, no sustituir un PNG de 64×64 |

Código eliminado: `src/app/nivel3d/`, `src/lib/minecraftRig.ts`, `src/lib/voxelTerrain.ts`, dependencia `three`.

### El suelo se renderiza, no se tesela en CSS

Se probó con teselas de 16×16 sobre rejilla. Más nítido, más ligero e infinito — pero **plano**, y al lado de un personaje que es render 3D con sombreado por cara el resultado parecía Terraria, no Minecraft.

La fidelidad pesaba más que el peso.

### Perfil puro, 0°. La inclinación de 15° se probó y se descartó

Se llegó a re-exportar `run` a 15° y a montarlo. **Revertido.**

El motivo es geométrico, no de gusto. Con la cámara inclinada:

```
altura en pantalla = altura_del_terreno × 0,97 + profundidad × 0,26
```

Cada bloque de profundidad **sube 0,26 bloques en pantalla**. Un horizonte lejano necesita mucha profundidad, y esa profundidad lo empuja fuera del encuadre. A 15° el presupuesto de profundidad visible son ~25 bloques: no cabe un fondo.

**Los 15° cambian horizonte por caras superiores. No se pueden tener las dos cosas.**

A 0° la profundidad no afecta a la altura en pantalla, así que se puede apilar mundo detrás sin límite. Por eso los side-scrollers usan perfil puro.

Lo que se acepta a cambio: sin caras superiores el brillo máximo se queda en ~0,68 y el plano se lee algo apagado. Se compensa con oclusión ambiental, sombras proyectadas y el `--world-grade` de CSS.

Consecuencia práctica: **`run` hay que re-exportarlo a 0°** (rotación X a 0, cámara Y de vuelta a 13, FOV 7). El resto de hojas y las capas de mundo nunca salieron de 0°, así que siguen valiendo.

### El personaje no se gira hacia cámara

Se planteó para arreglar la silueta de `idle`, que de perfil puro se lee estrecha. Descartado: la postura abierta resuelve bastante y girarlo desalinearía todas las hojas entre sí.

### Cielo, hora del día, fuegos y UI van en CSS

No se renderizan. El cielo en degradado permite recolorear la escena sin pedir un render nuevo, los fuegos quedan mejor como partículas en canvas, y rejillas, slots y tooltips en DOM son interactivos y accesibles.

---

## Reglas que aplican a todo

- **Entrega PNG, no video.** La codificación a WebP/WebM la hace el código.
- **Fondo transparente.**
  Mine-imator: *Transparent background*. Blender: *Render → Film → Transparent*.
- **Luz plana. Sin specular, sin brillos, sin naranja de atardecer.** La hora del día se aplica por CSS, así el mismo sprite sirve para amanecer y para noche. Un brillo horneado deja la skin clavada a esa iluminación.
- **Recorta el canvas al contenido.** Nada de márgenes muertos: cada píxel vacío se multiplica por el número de frames dentro de la hoja. En la prueba sobraba el 27% de cada frame.
- **Nada tocando el borde superior.** Deja margen para el brazo cuando sube.
- **Nombres en minúscula** con el nombre de la hoja: `peek_wave_000.png`, `peek_wave_001.png`…

**Escalado**: solo razones enteras. En la web los sprites se muestran a **1:2** — la celda de 600 px de alto se pinta a 300. Reducción limpia, sin píxeles a medias.

**`image-rendering: pixelated` no se usa en estos sprites.** Esa regla sirve para ampliar arte de 16×16; aquí se está reduciendo un render de 600 px, y el filtrado suave del navegador da mejor resultado. Sí aplica a las texturas de bloque de 16×16, que sí se amplían.

**Assets originales**: estética voxel inspirada, sí; texturas, logo o tipografía extraídos del juego, no. Tu skin es tuya y no da problema.

---

## Cámara

**Una sola cámara para el mundo entero**: personaje, terreno, capas de parallax y props. Móntala una vez y no la toques más.

```
proyección    ortográfica  (Mine-imator: FOV 7 + cámara muy alejada)
giro          lateral 90°
rotación X    0            ← perfil puro, sin inclinar
cámara Y      13
```

**El ángulo tiene que coincidir en todo. El zoom no.** Con proyección ortográfica acercarse no deforma nada, solo escala, así que las hojas de personaje se renderizan de cerca —con su recorte de 460×600, más nítidas— y las capas de mundo desde lejos. El código las cuadra.

**Excepción — `peek_wave`**: perspectiva e inclinación libres. Ese plano no está dentro del mundo, es el personaje asomándose hacia el usuario, y ahí la perspectiva juega a favor. Se recorta a propósito por el borde izquierdo y por abajo.

**FOV 7 no es ortográfica de verdad**, pero a esa distancia se comporta como tal: el semiángulo es 3,5°, lo que da un 0,2% de variación de escala entre el centro y el borde del cuadro. Sobre 1440 px son 3 px. Y como el frustum es simétrico, el teselado horizontal no se ve afectado.

### El truco de las pasadas

**Monta el terreno y el personaje en la misma escena.** Luego renderiza por pasadas, ocultando lo que no toca:

1. Solo personaje → hoja de sprites
2. Solo capa del suelo → `ground`
3. Solo capa cercana → `near`
4. Solo capa media → `mid`

Misma cámara, mismo lienzo, misma luz. **Las capas encajan solas al superponerlas**: no hay que calcular offsets, ni ajustar a ojo dónde pisa el personaje.

Con la cámara inclinada, alinear a mano sería un infierno. Así sale gratis, y es lo que hace viable este enfoque.

---

## Límites técnicos de las hojas

Una hoja se sube a la GPU como una textura única. El tope de lado ronda los 16384 px, pero el de memoria llega antes: una hoja de 42 megapíxeles ocupa ~170 MB descomprimida y mata un móvil.

**Techo: 40 frames por hoja, y la hoja por debajo de ~12 megapíxeles.**

| | Disparo único | Bucle |
|---|---|---|
| Montaje | **rejilla** | **tira horizontal** |
| fps de render | **12** | **30** |
| Por qué | Van gobernados por scroll, y el scroll es grueso: no distingue más resolución temporal | Van en tiempo real con `steps()` |

Una tira de 40 frames mediría 17400 px de ancho y no cabe. Por eso los disparos únicos van en rejilla.

---

## 1 · Sprite sheets

Celdas del mismo ancho y alto exactos. Recorta al bbox común de toda la secuencia — las medidas de abajo son objetivo, ajústalas a lo que dé tu animación y dime la definitiva.

### Disparos únicos — rejilla, 12 fps

| Archivo | Qué es | Frames | Rejilla | Celda |
|---|---|---|---|---|
| `peek_wave.png` ✅ | Asomo por el borde izquierdo, saludo, escondida. Medio cuerpo | **37** | 8×5 | **435×600** |
| `enter.png` 🆕 | Entra corriendo, frena y se queda quieto. Ver abajo | 20 | 5×4 | 460×600 |
| `open.png` | Se agacha, levanta la tapa del cofre, se yergue | 20 | 5×4 | ~400×600 |
| `takeoff.png` | Recoge las elytras, se las pone, despliega, se eleva | 28 | 7×4 | ~600×600 |
| `land.png` | Desciende, toca suelo, pasa a idle | 16 | 4×4 | ~500×600 |

### Bucles — tira horizontal

**Los fps no son 30 en todos.** Lo que importa es la duración del ciclo, no el número de frames: una acción rápida necesita muchos frames por segundo, una lenta no. `idle` a 30 fps daría un ciclo de respiración de 0,4 s, que es un jadeo.

| Archivo | Qué es | Frames | Ciclo | fps | Celda |
|---|---|---|---|---|---|
| `run.png` ✅ | Ciclo de carrera. Lateral puro, corre en el sitio, no avanza | **15** | 0,50 s | 30 | **460×600** |
| `idle.png` 🟡 | Quieto, respiración leve. Para las dos paradas | **16** | **2,0 s** | **8** | **460×600** |
| `craft.png` | Golpea la mesa de crafteo. Swing de brazo | 16 | 0,80 s | 20 | 460×600 |
| `fly.png` | Planeo. Cuerpo horizontal, alas extendidas | 12 | 1,2 s | 10 | ~700×400 |

**`idle` y `craft` van en el mismo canvas 460×600 que `run`, con el personaje en la misma posición del mundo.** Si el encuadre cambia, el personaje pega un salto al cambiar de hoja cuando se detiene.

> **Los bucles tienen que cerrar perfecto.** En `run`, `idle`, `craft` y `fly`, el último frame debe empalmar con el primero sin salto. Se nota en cada repetición y no hay forma de taparlo desde el código.

**Referencias medidas** — hojas entregadas y montadas con la cámara antigua:

| Hoja | Frames | Montaje | Dimensión | WebP |
|---|---|---|---|---|
| `peek_wave` | 37 | rejilla 8×5 de 435×600 | 3480×3000 | 269 KB |
| `run` | 15 | tira de 460×600 | 6900×600 | 80 KB |
| `idle` | 16 | tira de 460×600 | 7360×600 | 45 KB |

Total: **394 KB**. Presupuesto de sprites: ~1,2 MB.

`peek_wave` e `idle` **están bien**: nunca salieron de 0°. Solo `run` hay que re-exportarlo, porque se llegó a hacer a 15° antes de revertir la decisión.

---

## 2 · Props

PNG con alfa, misma luz plana y mismo estilo que el personaje.

| Archivo | Qué es |
|---|---|
| `crafting_table.png` | Mesa de crafteo |
| `chest_closed.png` | Cofre cerrado |
| `chest_open.png` | Cofre con la tapa levantada |
| `elytra.png` | Las elytras como item, flotando en el cofre |
| `sign.png` | Un cartel vacío — se reutiliza ×3, el texto va en DOM |

---

## 3 · El mundo — todo renderizado

**Nada de teselas CSS.** El suelo, el terreno de fondo y los árboles salen de la misma escena que el personaje, con la misma cámara y la misma luz. Esa es la única forma de que mundo y personaje sean la misma cosa.

Todas las capas se sacan por pasadas de la misma escena (ver *Cámara*), así que **encajan solas**.

| Archivo | Qué es | Altura del terreno | Niebla |
|---|---|---|---|
| `b1_ground.png` | Suelo donde camina + árboles de primer plano | 4 bloques | 0% |
| `b1_near.png` | Terreno de fondo con árboles | 4-6 | ~15% |
| `b1_mid.png` | Terreno medio | 6-9 | ~40% |
| `b1_far.png` | Montañas del horizonte | **9-12** | ~65% |
| `b1_ref.png` | **Solo el personaje**, quieto, donde le toca | — | — |

**PNG con alfa, sin cielo** — el cielo y la hora del día se generan en CSS.

`b1_ref.png` cuesta un clic y ahorra una vuelta entera: con él se mide la escala exacta y dónde caen los pies, sin estimar.

### La receta de niebla — cómo se da distancia a 0°

En perfil puro **la profundidad no mueve nada en pantalla**: un bloque a 5 de fondo y otro a 200 se dibujan a la misma altura. Eso libera el presupuesto de profundidad —puedes construir tan atrás como quieras— pero deja solo dos herramientas para que se lea la distancia.

**1 · Niebla.** Es la principal. Cada capa más lejos, más lavada hacia el color del cielo y con menos contraste. Los porcentajes de la tabla son el objetivo.

Con la niebla activada en la escena y las capas a distinta Z, **cada pasada sale con su cantidad automáticamente**. No hay que ajustar capa por capa: se configura una vez, de ~20 a ~120 bloques, color del cielo.

**2 · Altura.** Lo lejano tiene que **ser alto**, porque la distancia no lo sube. Las montañas del horizonte van a 9-12 bloques; el suelo, a 4. Si haces el fondo bajo, se queda pegado al suelo y no hay horizonte.

> Esto es lo contrario de lo que pedía la cámara inclinada, donde la profundidad elevaba el terreno sola y lo lejano tenía que ser **bajo** para no salirse del cuadro. Con 0° vuelve a valer la regla intuitiva: **más lejos, más alto y más grande.**

**3 · Velocidad de parallax**, ya en código: `ground` 1,0 · `near` 0,55 · `mid` 0,3 · `far` 0,15.

**Profundidad en Z**: colócalas donde quieras, con hueco entre ellas para que la niebla las separe. Orientativo: `ground` 0, `near` −10, `mid` −30, `far` −70. Ninguna se sale del encuadre por estar lejos.

### Encuadre y tamaño

```
3840 × 1440   (2560 de ancho vale si el render va lento)
```

**El encuadre tiene que abarcar 12-13 bloques de alto.** La cuenta:

| | |
|---|---|
| Suelo visible bajo el personaje | 2 bloques |
| Árbol completo | 7 bloques |
| Cielo libre arriba, para los paneles | 3 bloques |
| **Total** | **12 bloques** |

A 112 px por bloque en un lienzo de 900 solo caben 8 y las copas se cortan. La solución es **alejar la cámara**, no subir el lienzo.

**Chequeo antes de renderizar**: con el encuadre correcto, el personaje ocupa **1/7 del alto del cuadro**. Si es más alto, estás demasiado cerca.

El suelo por donde camina el personaje va **plano**: el código lo coloca a altura fija y con desniveles flotaría o se hundiría. El relieve va en las capas de fondo.

Deja **cielo libre en el tercio superior derecho**: ahí viven los paneles de texto y una pared de hojas los haría ilegibles.

**Teselables**: el borde izquierdo tiene que empalmar con el derecho sin costura. El recorrido supera los 4000 px y una capa fija se acaba a media carrera. Teselable se repite y el mundo es infinito por el mismo peso. El frustum es simétrico, así que el teselado horizontal no se ve afectado.

**Los árboles van dentro del render.** Ya no se construyen con bloques en CSS.

La capa `far` va sin detalle de bloque distinguible — a esa distancia la niebla se lo come, y fingirlo queda peor que no ponerlo.

### Profundidad

Cada capa se coloca a distinta distancia **dentro de la escena**, no se escala después. La ortográfica hace que lo lejano no encoja solo, así que la sensación de distancia la dan la niebla, el oscurecido y la velocidad de parallax, no el tamaño.

### Escala de referencia

El personaje mide ~200 px en pantalla y un jugador de Minecraft son 1,8 bloques de alto, así que **un bloque cae en ~112 px**. Sirve para dimensionar el terreno: una colina de 3 bloques son ~336 px.

---

## 4 · Sueltos

| Archivo | Specs |
|---|---|
| `skin.png` | 64×64, el archivo de skin tal cual. De ahí salen favicon y avatar |
| `icons/<tech>.png` | 64×64 con alfa, ~12 piezas, iconos de stack para la mesa |
| `projects/<slug>.png` | 128×128, una miniatura por proyecto |
| `tex/*.png` | 16×16 teselables, **originales**. Ya no cargan el suelo — eso se renderiza. Quedan solo para bordes de paneles y fondos de UI: `wood`, `stone`, `dirt` |
| `cv.pdf` | 1–2 páginas, versión limpia sin tema |

---

## No renderizar

Se generan por CSS o canvas y no cuestan peso:

- Cielos, degradados, hora del día
- Fuegos artificiales del despegue
- Rejillas, slots, tooltips
- Barra de carga
- El texto de los carteles

---

## Orden de producción

- [ ] **0 · Validar el enfoque — SOLO TRES PIEZAS**
  `run` re-exportado a 0°, `b1_ground` y `b1_ref`.

  **No hagas nada más hasta ver esto montado.** Con tres renders se comprueba si mundo y personaje por fin son la misma cosa. Si el enfoque falla, has perdido tres piezas en vez de doce.

- [ ] **1 · El resto del bioma 1** — `biome1_mid`, `far`, y re-export de `peek_wave` e `idle`

- [ ] **2 · Biomas 2 y 3** — `ground`, `near` y `mid` de cada uno
  No empezar hasta tener escritos los tres mensajes: el texto decide qué bioma va en cada tramo.

- [ ] **3 · Las paradas** — `craft.png`, `open.png`, mesa, cofre ×2, iconos de stack, miniaturas de proyecto

- [ ] **4 · El final** — `takeoff.png`, `fly.png`, `land.png`, `elytra.png`, `sign.png`
  Lo último, porque es lo único recortable si el recorrido se está haciendo largo.

**Peso estimado: ~2,1 MB de sprites + ~900 KB de capas.** Techo: 5 MB.

Las capas suben el peso frente a las teselas CSS. Es el precio de la fidelidad y entra de sobra en el presupuesto.

---

## Contenido pendiente

No son assets, pero bloquean producción. Los tres primeros deciden qué se renderiza.

- [ ] **Los 3 mensajes del tramo de carrera** — el "sobre mí" partido en tres ideas. Cada mensaje decide su bioma: bosque, desierto, nieve, cueva
- [ ] **Los proyectos** — título, qué es, stack, link, y qué item representa a cada uno
- [ ] **Las 12 tecnologías de la mesa** — según cuáles sean, los iconos pueden salir de librerías libres en vez de dibujarse
- [ ] **Links de contacto** — qué va en cada uno de los tres carteles
- [ ] **CV en PDF**

---

## Pendientes del render — lista viva

Por orden de impacto. Ninguno bloquea la maqueta: `/recorrido` funciona hoy con lo que hay.

### 0 · `run` a 0° — bloqueante

Es la única hoja que quedó a 15°. Rotación X a **0**, cámara Y de vuelta a **13**, FOV 7. Los frames y el canvas no cambian.

**Exporta hasta el 15 y para.** En el último export el frame 16 era copia byte a byte del 01 y el ciclo tropezaba. Los frames 08 y 09 también salieron casi idénticos; si puedes, separa esas dos poses — si no, se sigue descartando el 09 en el montaje.

### 1 · Iluminación tipo shader

Lo que más va a cambiar el resultado. Medido sobre `test_ground`: la saturación está bien (0,528) pero **el brillo máximo se queda en 0,68**. Sin luces altas, el ojo lee "apagado" aunque el color sea correcto.

Dentro de Mine-imator, por impacto:

| | Qué hace |
|---|---|
| **Oclusión ambiental** | Oscurece los rincones: base de troncos, ángulos de terraza, bajo las copas. El mayor salto de los cuatro — sin ella todo flota |
| **Sombras + sol direccional** | Un árbol proyectando sobre el terreno de atrás rompe la planitud al instante. Ponlo alto y lateral para que se alarguen |
| **Niebla** | Color del cielo, de 25 a 55 bloques. Tapa el borde del mundo y crea el degradado de profundidad |
| **Bloom leve** | Muy suave. Da la sensación de sol real; pasado de rosca es sopa |

**Lo que no se puede tener**: las caras superiores al 100% de luz. Solo aparecen inclinando la cámara, y eso se descartó porque mataba el horizonte. Es el precio asumido del perfil puro: el brillo máximo se queda en ~0,68 y hay que compensarlo con oclusión, sombras y el grado de CSS.

Para shader de verdad —luz volumétrica, agua reflejando, hojas moviéndose— es Minecraft real con BSL o Complementary vía Replay Mod. Solo sirve para `layer_far`, que va sin alfa: graba el mundo entero y no recorta.

### 2 · Más fondo — `layer_far`

Tercera capa, la más lejana, moviéndose a ~0,25. Con tres en vez de dos el parallax se nota bastante más.

Referencia visual en `/nivel`, donde monté dos crestas de fondo. Los principios a copiar:

- **El color tira al del cielo**, azul grisáceo, no verde
- **El contraste se desploma** — nada de negros ni blancos, todo comprimido al medio
- **La base se disuelve, la cresta no** — la neblina se acumula abajo
- **Sin detalle de bloque**, solo silueta
- **Bloques más grandes, no más pequeños** — una montaña lejana es enorme; lo que da distancia es el color, no la escala

### 3 · Ajustar tamaños

Dos medidas del render de prueba:

**Encuadre**: abarca 5,4 bloques de alto, hacen falta **12-13**. Por eso se cortan las copas. El personaje debe ocupar **1/7 del alto del cuadro**; ahora ocupa 1/3.

**Ancho**: 3840 px escalados a 1080 de alto dan 2880, y en pantalla ancha eso deja **960 px de recorrido** — medio scroll. Hacen falta 3-4× más de ancho, **o que sean teselables**, que es mejor: se repiten y el mundo es infinito por el mismo peso.

### 4 · `enter.png` — entrada al mundo

Ahora mismo la entrada está falseada moviendo el sprite de `run` con una curva de frenada. Funciona, pero al decelerar la zancada no acompaña del todo.

```
frames    20
ciclo     1,0 s  ->  20 fps
montaje   rejilla 5×4
canvas    460 × 600, igual que run e idle
posición  corre EN EL SITIO; el avance lo pone CSS
```

Contenido: dos zancadas corriendo → frenada → se yergue → queda quieto.

**El último frame tiene que ser idéntico al frame 01 de `idle`.** Es donde se encadena, y si no coinciden pega un salto — la misma regla que el cierre de un bucle.

### 5 · `layer_front.png` — opcional

Dos o tres árboles del plano más cercano, dibujados **encima** del personaje. Ahora `ground` lleva los árboles incrustados, así que el personaje solo puede ir delante de todo o detrás de todo: nunca pasa por detrás de un tronco. Con esta pasada el orden queda `near` → `ground` → personaje → `front`.

---

## Pendiente en `idle` — hacerlo en el re-export

La respiración está resuelta (10 px de recorrido, 16 frames, bucle limpio). Lo que falta es abrir la postura: de perfil puro los brazos tapan el torso y una pierna tapa la otra, así que a 300 px en pantalla se lee como un bolo en vez de una persona.

**Aprovecha el re-export de cámara para meter esto en la misma pasada.** Las piernas son valores fijos sin keyframes; los brazos, un desplazamiento de pista.

| Parte | Ahora | Súmale | Queda |
|---|---|---|---|
| Pierna adelante | +9° | **+7** | +16° |
| Pierna atrás | −9° | **−7** | −16° |
| Brazo cercano | +7° | **+9** | +16° |
| Brazo lejano | −5° | **−5** | −10° |

Esperado: los pies pasan de 91 a ~125 px de separación y el torso queda visible entre los brazos.

Con la cámara en perfil puro no hay nada que lo resuelva solo, así que los incrementos van enteros.

---

## Pendiente de decidir

- [ ] **¿El saludo se lee como saludo?** En `peek_wave` el brazo sale lateral y barre en horizontal, siempre por debajo de la altura de la cabeza. Si al verlo en la página el gesto queda ambiguo, la corrección es subir el brazo por encima del hombro y darle dos oscilaciones en vez de un barrido.

**Resuelto** — el "contorno blanco" que se veía en la primera prueba no era un outline: son las caras superiores de los cubos recibiendo luz. Es sombreado por orientación de cara, igual que hace el propio juego, y se queda.

---

## Herramientas

- **Mine-imator** — rápido, curva suave, alfa nativo. La opción por defecto.
- **Blockbench + Blender** — mejor acabado, más trabajo.
- **Replay Mod + shaders** — solo para fondos de escena completa. No sirve para sprites con alfa: captura el mundo entero y no recorta al personaje.
