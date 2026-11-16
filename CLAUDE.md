# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev       # dev server con Turbopack
npm run build     # build de producción
npm run start     # servir el build
npx tsc --noEmit  # type-check (no hay script definido)
npm test          # tests, con el ejecutor de Node
```

No hay linter propio. `npm run build` sí pasa ESLint.

**Los tests van en `tests/*.test.mjs` y no llevan framework**: `node --test`
importa los `.ts` tal cual. Por eso solo alcanzan a módulos sin React, sin
navegador y sin el alias `@/` (`watchSheet.ts`, `spriteFrames.ts`,
`characterSheets.ts`, `smoothing.ts`, `teleport.ts`): la lógica
que merezca test se saca a un módulo así. El aviso de `MODULE_TYPELESS` al
correrlos es inofensivo; no añadir `"type": "module"` al `package.json`.

**Para probar sin navegador a mano: `scripts/dev/browse.mjs`.** Abre el
sitio en Chromium sin ventana, a la ventana y densidad que se le pida,
ejecuta un script en la página y opcionalmente guarda una captura:
`node scripts/dev/browse.mjs 400x820 2 1 '<js>' [captura.png]`. Renderiza por
software: vale para posiciones y tamaños, no para medir rendimiento.

**No lances `npm run build` con `npm run dev` corriendo**: comparten `.next` y el
resultado son 500 hasta que se borra el directorio.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + CSS Modules.

Tailwind v4 está instalado y `globals.css` hace `@import "tailwindcss"`, pero
**ningún componente del mundo usa clases de Tailwind**: todo va en módulos CSS.

`--font-display` (Space Grotesk, variable, en `public/fonts/`) para titulares y
navegación. Los paneles del juego van en monoespaciada a propósito. **No es una
fuente de píxel**: el mundo ya es Minecraft entero y repetirlo en el texto lo
dejaba todo en una nota.

Alias: `@/*` → `./src/*`.

## Rutas

| Ruta | Qué es |
|------|--------|
| `/` | El mundo recorrible. Client component. |
| `/simple` | El mismo contenido en texto. **Server component, 0 B de JS propio.** |

`/simple` no es un plan B estético. En `/` los paneles se montan al acercarse
caminando, así que **el HTML servido no contiene ningún proyecto**: buscadores,
previsualizaciones de enlace y lectores de pantalla no ven nada. Las dos rutas
leen de `@/content/portfolio`, así que el texto se toca en un solo sitio.

## Arquitectura del mundo

Todo el recorrido vive en `src/app/page.tsx` (client component grande) con los
paneles y piezas en `src/components/`.

### El scroll es una posición, no una línea de tiempo

Una sola correspondencia `scrollY → worldX`. Las secciones son **lugares** con
una coordenada `at` (0→1), no pantallas. Nada se dispara por eventos: todo es
función de dónde estás, así que no hay estado que sincronizar ni re-disparos al
volver sobre tus pasos.

```
SCROLL_LENGTH = 7000    px de scroll del documento
WORLD_LENGTH  = 12000   px de mundo recorridos
LAYER_SPEED   = { far: 0.15, mid: 0.3, near: 0.55, ground: 1 }
```

### Capas y biomas

Cada bioma (`b1`…`b5`) tiene hasta cuatro capas en `public/layers/`. Por orden
del recorrido: bosque (Inicio), desierto con templo (Sobre mí), taiga
(Experiencias), cerezos (Skills) y acantilado (Contacto). El desierto y la taiga
se intercambiaron para que el podio fuera en la nieve. Se montan
solo los biomas dentro de `MOUNT_RADIUS`: una capa ocupa decenas de MB
descomprimida y cinco a la vez matan un móvil.

**Las capas enteras (3840 px) son solo para pantallas grandes.** Las `@half`
se sirven por debajo de `HALF_RES_WIDTH` (900 px) y siempre que la tesela
ocupe en píxeles físicos menos de `FULL_RES_FROM` veces la media
(`wantsHalfLayers`). Mandaba solo el ancho, y un portátil de 1080p al 125%
cargaba las de 3840 para encogerlas en cada frame: 36–45 fps en una Intel
UHD, 60 con las medias.

**Las capas no se copian a mano.** Se renderizan todas al mismo lienzo de
3840×3000 y `scripts/import-layers.py` las recorta, codifica y genera
`src/content/layers.ts` con el alto de cada una y las constantes de escala
(`BLOCK_PX_SOURCE`, `GROUND_BELOW`, `WORLD_UNIT`). **Ese archivo se genera: no
editarlo a mano.** El porqué de cada recorte está en `ASSETS.md`.

Cada capa conserva su propio alto y va anclada abajo, así que la de los árboles
sobresale por encima de la caja del mundo en vez de quedar aplastada dentro. Eso
es lo que arregló el recorte de copas en móvil vertical.

**Los biomas se recortan a su territorio, no se funden.** Fundir por opacidad
mostraba dos terrenos a la vez —cactus sobre cerezos— y además dejaba pasar el
cielo, porque dos capas al 50% componen un 75% y no un 100%. La frontera dura
tampoco es una concesión: en el juego los biomas cambian de golpe.

El recorte lleva un término `-worldX * (1 - speed)` para que la frontera caiga
en la **misma x de pantalla en todas las capas** pese a que cada una corre a su
ritmo. Sin él, el fondo cortaba el bioma mucho antes que el suelo. Ese cálculo
vive en **un solo sitio**, `placeWorld`, y ya dio problemas por estar duplicado.

`Strip` (en `ParallaxLayer.tsx`) repite la imagen **alternando volteada**: los
renders no son teselables, y así el borde derecho de una copia toca siempre el
borde derecho de la siguiente. Monta solo las teselas que su bioma puede llegar
a enseñar, calculadas desde el territorio.

### El bucle: nada de estado por frame

`page.tsx` tiene un `requestAnimationFrame` que **escribe al DOM por refs**. No
usa `setState` para nada que cambie cada frame.

Esto no es preferencia: con doce `setState` por frame React reconciliaba el
árbol entero —cuatro contenedores, sus tiras y sus decenas de `<img>`— sesenta
veces por segundo.

Reglas al tocar el bucle:

- **Posición del mundo** → `placeWorld(at)`. Capas, recortes, pies y hora del
  día. Lo comparten el bucle y el reaterrizaje al volver.
- **Frame del sprite** → `writeFrame(index)`. Lee la hoja del `data-state` del
  propio nodo, **nunca de `stateRef`**: el cambio de estado llega al DOM un
  frame más tarde. Cuando `run` y `walk` tenían distinto ancho de celda, el
  desplazamiento caía entre dos celdas y se veían dos poses a la vez. Hoy las
  cinco hojas comparten geometría, pero la regla sigue: una hoja nueva puede
  no hacerlo.
- **Lo que sí es estado** va cuantizado: `NIGHT_STEPS = 24`, `PANEL_STEPS = 20`.
  La noche mueve un `filter` CSS sobre superficies del ancho del mundo, y
  re-filtrar eso por frame era carísimo.

- **La marcha se elige con margen, y en segundos.** Correr, caminar o parado
  salían de la velocidad de cada frame contra un umbral fijo, y un golpe de
  rueda —un pico que se apaga en un cuarto de segundo— era correr, caminar y
  parar: con la rueda lenta, 26 cambios en 4 s. Ahora manda una velocidad
  suavizada (`PACE_SECONDS`), dejar de correr pide bajar más de lo que costó
  arrancar (`SPEED_RUN_OFF`), cada marcha dura un mínimo
  (`GAIT_HOLD_SECONDS`) y el reposo espera `IDLE_SECONDS` —poco: en esa
  espera la zancada no avanza y con 0,3 s se quedaba clavado al frenar—. Todo en segundos:
  en frames, a 120 Hz valía la mitad.
- **Los suavizados van por tiempo, no por frame** (`easeFor`, en
  `smoothing.ts`). Eran `valor += (destino - valor) * 0.12` a secas, y a
  120 Hz el mundo seguía al scroll el doble de rápido que a 60; a 30 fps, la
  mitad. `easeFor(0.12, dt)` da 0,12 exacto a 60 Hz y lo equivalente a
  cualquier otra tasa. Un suavizado nuevo en el bucle va por aquí.
- **La zancada tiene cadencia mínima (`MIN_CADENCE`).** Sale de la distancia
  recorrida, y al frenar la distancia se acaba antes que la marcha: se quedaba
  un cuarto de segundo clavado en una pose de correr.
- **La zancada se lleva en ciclos (`cycle`), no en frames.** `run` tiene 16 y
  `walk` 25: el mismo índice es otra fase del paso en cada hoja, y al cambiar
  de marcha el pie saltaba.

En reposo el ciclo lo lleva el CSS (`data-driven` ausente → animación activa).
El bucle **no** debe escribir el frame en `idle`.

### Sentarse: lo único que no es una posición

Al llegar al acantilado el personaje se sienta, y ese gesto **va por tiempo, no
por scroll**: `SIT_AT`, `SIT_RELEASE`, `SIT_SECONDS`. Es la excepción
deliberada a la regla de arriba — sentarse es algo que se hace al llegar, no una
consecuencia de dónde está la rueda.

Tres cosas que costaron y conviene no deshacer:

- **Las condiciones son asimétricas.** Sentarse mira `current` (haber llegado);
  levantarse mira `target` (haberte ido). Con el mundo congelado `current` deja
  de moverse, así que mirarlo para decidir levantarse dejaría al personaje
  sentado para siempre. Y el orden importa: la condición de levantarse se
  evalúa primero.
- **El mundo se congela mientras dura el gesto** (`sitLockRef`), y también
  mientras sigue sentado. Es además el freno del scroll en el borde.
- **Al soltar, la recuperación va acotada** a `CATCH_UP_BLOCKS`. Sin tope, el
  primer frame cierra cientos de píxeles de golpe y el personaje sale disparado.

### El podio: el otro gesto que no es una posición

En la taiga, pasado el cofre, hay un escenario con un podio. **Al pulsarlo**
el personaje camina hasta el estrado, sube —dos saltos, 2.º puesto y luego
1.º—, se gira hacia la cámara con una medalla y celebra. Comparte mecanismo
con sentarse: corre por tiempo (`PODIUM_SECONDS`), congela el mundo con
`sitLockRef`, y **no escucha la rueda hasta terminar**; al alejarte baja con
la animación al revés, entera.

Lo que tiene de distinto, y por qué:

- **Se pide, no se dispara al llegar.** Hubo una versión que subía al
  detenerse delante. La zona eran 84 px de scroll: con la perla se acertaba
  siempre y con la rueda casi nunca, así que una vez abajo no se podía volver
  a subir. Y con el escenario ocupando medio bioma, proyectos y hackatones se
  pisaban. Ahora quien camina solo ve el cofre; el podio es decorado hasta
  que se pulsa.
- **Se pulsa el escenario entero, y lo avisa una medalla** (`.podiumHit`,
  `PodiumMedal`) que flota y gira a la entrada como un objeto soltado. Hubo un
  botón de la barra plantado ahí y no gustó: era interfaz en mitad del mundo.
  La medalla no va sobre el primer puesto porque ahí cae bajo el cajón de
  proyectos. En estrecho ese cajón tapa el escenario entero, así que dentro
  lleva además un enlace (`onPodium`): sin él en móvil no se podría pedir.
- **Va andando, sin perla.** Solo se puede pedir teniéndolo delante.
  `climbPodium` mueve el scroll a `PODIUM_AT` y el suavizado del mundo hace
  la caminata. Dos cuidados: el gesto no arranca hasta estar a píxeles del
  sitio (`PODIUM_ZONE`) y entonces el mundo se clava en `PODIUM_AT` exacto,
  porque lo que falte por andar flotaría fuera de la columna; y el corrimiento
  al 7% va acompasado con lo andado, o patinaba de lado con el mundo quieto.
  Mover la rueda de camino lo cancela (`PODIUM_CANCEL`).
- **Baja por donde te vas.** Hacia atrás, la hoja al revés: 2.º puesto y
  suelo. Hacia delante, por el 3.º y la alfombra del otro lado
  (`podiumPose`, `PODIUM_WAY_DOWN`): se gira de perfil con el final de la
  hoja al revés y repite los dos saltos hacia delante. Se decide arriba
  (`podiumAheadRef`) y no cambia a medio salto. Al tocar suelo queda a media
  pantalla de su 20%, con el mundo aún clavado: **no se recoloca de golpe**
  —era un corte de cámara de 765 px—, se queda donde cayó, quieto, y el
  mundo avanza hasta alcanzarlo (`podiumLandRef`).
- **Los saltos los mueve la página, no la hoja.** `climb` va dibujada en el
  sitio; `hopSpot` da el desplazamiento de cada frame. Así la hoja no
  depende de la altura de las columnas.
- **Dónde pisa lo dice el render.** `STAGE` son píxeles que imprime
  `scripts/render/world.py`. Un bloque más al fondo cae más abajo en pantalla
  de lo que dice su altura; calculado a mano, flotaba sobre el podio.
- **El estrado se sube andando.** Media losa, de golpe, como en el juego: es
  función de la posición y vale también para quien cruza sin subir.
- **En el podio el personaje se va al 7% del ancho** (`PODIUM_X`), y solo
  entonces. Al 20% el primer puesto caía bajo el velo del cajón; atado a la
  posición, quien cruzaba andando lo veía frenar y acelerar.
- **Su cajón lo abre el gesto, no la distancia**, y mientras está abierto
  cierra el del cofre. En ancho va más
  estrecho (`slim`): a 42% tapaba media columna del tercer puesto.

El escenario es una capa propia, `b2_stage`, **anclada y en una sola copia**.
No va pintado en el suelo porque el suelo se repite volteado y saldría otro
podio con los números al revés.

**El cofre va pegado al escenario por la izquierda**, no en el `at` de la
sección, donde caía encima del primer puesto. Es un render del modelo del
juego con su textura (`scripts/render/props.py`), a la escala del mundo: 14
de los 16 píxeles de un bloque. Su sitio se calcula (`chestLeft`,
`chestAtRef`) porque todo ello crece con el alto de la pantalla.
«Experiencias» aterriza ahí, con el cofre a la espalda y el escenario delante.

**Los carteles de Contacto son el cartel de roble del juego**, renderizado
igual que el cofre (`props.py sign`); `Signs.tsx` solo le escribe encima, en
negro y centrado como en el juego. Fueron dos cajas de color en CSS. Van **en
proporción al personaje** —un bloque de ancho y algo más de uno de alto, contra
los casi dos que mide él—, así que su tamaño sale del alto de la ventana
(`vh`), no del ancho: atados al ancho le llegaban por los hombros. En vertical
el personaje es demasiado pequeño para seguirlo: se quedan en su mínimo
legible y se les acorta el poste. Se oscurecen de noche menos que el terreno,
para poder leerlos. En un móvil se reparten **dos a cada lado del
personaje**, que aterriza al 41% del ancho: los cuatro seguidos llenaban la
pantalla y él quedaba detrás de uno.

Los eventos están en `EVENTS` (`src/content/portfolio.ts`). Tres tienen puesto
y suben; el que no, va aparte como logro del juego.

**Los eventos llevan fotos** (`photos` en `EVENTS`, archivos en
`public/events/<id>-<n>.webp` a 1920 px). En el cajón del podio cada uno
enseña la miniatura de su portada (`<id>-thumb.webp`) con el número de fotos, y
al pulsarla se abren en el visor. Tres por evento, elegidas entre las que
mandó Vicente: se dejaron fuera las de público general, donde sale mucha
gente que no eligió estar en un portfolio, y los `alt` describen la escena
sin nombrar a nadie. NASA no tiene todavía. Los originales no están en el
repo. `npm test` comprueba que cada foto declarada exista.

### Hojas del personaje: a la mitad y ya calientes

Los datos de las hojas viven en `characterSheets.ts`, sin React, para poder
probarlos contra los archivos (`npm test`).

- **Cada hoja tiene su `@half`** (celda de 300 px) y es la que se sirve salvo
  en pantallas grandes (`wantsHalfSheet`, `FULL_SHEET_FROM`). Las enteras se
  usaban siempre: en un portátil de 1080p la celda son 270 px físicos, 2,2
  veces menos de lo que traía la hoja, y cada una ocupaba 18–35 MB
  decodificada. `climb` y `sit` enteras rozan además el tope de textura.
  **Al renderizar una hoja nueva hay que generar también su `@half`**
  (`magick x.webp -resize 50% x@half.webp`); el test lo exige.
- **Se calientan al entrar** (`.warm`): un píxel de cada una, pintado a la
  escala a la que se usa. Una hoja se decodifica la primera vez que se pinta,
  y eso era un tirón de 100–250 ms justo al echar a andar, al lanzar o al
  subir al podio. Medido en una Intel UHD: con el personaje, 4 de 4 pasadas
  con el tirón; sin él, ninguna. `decode()` no sirve para fondos CSS, y
  pintarla a 1×1 con el fondo encogido tampoco: decodifica otra escala.
  Con las dos cosas, en ese equipo: de 39–50 fps a 56–60 con carga fresca, y
  el tirón de echar a andar no aparece en 8 pasadas de 8.
- **Queda un tirón menor al echar a correr por primera vez** (67–167 ms, en 4
  pasadas de 8), que el calentado no evita. Sin diagnosticar: o Chrome suelta
  la hoja decodificada antes de que haga falta —`run` se usa mucho después
  que `walk`—, o el coste es del cambio de animación y no de la imagen. La
  prueba pendiente es calentar `run` pintándola entera un frame.

### Precarga en dos tiempos

La pantalla de carga solo espera `b1` y los sprites. Al terminar, los bytes de
las demás capas se descargan en segundo plano (`fetch`, sin descomprimir), y el
bucle **descomprime por adelantado** el bioma que viene con `PREWARM_RADIUS`,
reteniendo la imagen para que montarla no cueste. Bajar todo en la carga son
~400 MB descomprimidos: iOS mata la pestaña.

### Navegación por perla de ender

Clic en la navbar → el personaje lanza una perla. El salto de scroll ocurre
**mientras la perla está fuera de pantalla**, así que no hay corte que
disimular. La perla sale de la mano en el frame de máxima extensión, no del
centro del personaje: la geometría de la hoja dice dónde está esa mano.

`landingFor(index)` decide dónde se aterriza: no es la sección exacta, porque
caer justo encima deja la siguiente frontera dentro del cuadro.

### La otra forma de irse: `/tp` por el chat

A veces, en vez de lanzar la perla, se abre el chat del juego abajo a la
izquierda, se escribe solo `/tp <sitio>`, y el personaje se deshace en
partículas donde está y se rehace en destino. Responde como el juego:
«Vicente fue teletransportado a Skills».

- **Cuál toca lo decide `pickTeleport`** (`teleport.ts`, con tests). Sentado
  en el acantilado o subido al podio, **siempre el comando**: la perla se
  lanza de pie y de perfil, y desde ahí el gesto no casaba con nada. De pie,
  la perla dos de cada tres veces. `?tp=1` y `?tp=0` fuerzan uno u otro.
- **De pie teclea** (hoja `type`: el reposo con la cabeza baja y las manos
  delante, hecha sobre `poses/idle.json`). Sentado o en el podio se queda
  como está: no hay hoja de teclear para esas posturas.
- **No hay vuelo que tape el corte.** Lo tapa que entre los dos estallidos no
  hay personaje (`blink` en `EnderPearl`): desaparece a los 110 ms de enviar
  y reaparece a los 320.
- **El bioma de destino se decodifica desde que se pide** (`warmAtRef`), para
  la perla también. Sin eso, con el comando se llegaba a un cielo pelado: el
  vuelo de la perla daba medio segundo de margen y aquí no lo hay.
- **`Chat.tsx` está partido en barra de entrada y registro** a propósito. Hoy
  la barra se escribe sola; el día que escriba el visitante se cambia por un
  campo de texto y lo demás vale.

### Al volver a entrar

El navegador restaura el scroll por su cuenta y lo deja en el píxel exacto —si
eso cae entre dos biomas, apareces en la franja de la frontera. `armResume`
redondea a la sección más cercana (vía `landingFor`), monta su bioma, desplaza
el documento y **se salta el saludo**; la entrada caminando y el reposo se
quedan.

El mundo se coloca **antes** de la caminata. Colocarlo al arrancar el bucle
—que no arranca hasta `ready`— hacía que se viera el bioma inicial durante toda
la entrada y el fondo cambiara de golpe al terminar.

### Clima (`Weather.tsx`)

Partículas en canvas, una receta por tipo. Cada partícula lleva profundidad
(0.25–1.0) que escala tamaño, velocidad y opacidad, y la arrastra el avance del
mundo, así que el clima pertenece al sitio y no a la pantalla.

- `from: 'top' | 'side'` — **no es cosmético**. La arena deriva a ~900 px/s y
  cruza la pantalla en cuatro segundos; cayendo a 30 px/s tardaría catorce en
  bajar hasta el cuadro. Naciendo arriba moría fuera de plano sin verse nunca.
- `stretch` va **por partícula**, no por receta activa: en las fronteras
  conviven dos climas y con un estirado global la nieve salía en rayas.
- La nieve cae en diagonal porque su deriva no cruza el cero. Un rango que va de
  negativo a positivo promedia cero y deja la nieve cayendo a plomo.

La tormenta de arena además **quita visibilidad**, con velos (`.scrim*` en
`recorrido.module.css`) intercalados entre capas: el lejano se borra mucho antes
que el cercano, que es lo que la hace leer como tormenta en vez de como un bajón
de brillo. Son del tamaño de la pantalla, **no del mundo** — meterlo en el
`filter` de las capas obligaría a re-rasterizar 20.000 px de ancho por frame.

Y respira: dos senos de periodo inconmensurable multiplican la fuerza, así que
en las calmas asoma el templo del fondo. El multiplicador afecta a partículas,
velo y visibilidad a la vez; si solo pulsara una de las tres se notaría.

### Los paneles: un cajón lateral

`Panel.tsx` es la carcasa común de los tres —libro, inventario y mesa de
crafteo—: posición, velo, entrada, apertura y el bloqueo de foco. Cada
componente se queda solo con su contenido.

Va **a la derecha** porque el personaje camina al 20% del ancho: los paneles
centrados de antes lo tapaban justo al llegar a la sección, que es cuando más
apetece verlo. El velo sobre el mundo va en degradado, no con borde recto.

El marco es sobrio a propósito. Lo que conserva la identidad del juego es lo que
va **dentro** —las ranuras de inventario, el marco del retrato—, no la caja de
piedra biselada que lo envolvía. Los botones y la paginación van limpios: son
navegación, no la metáfora.

**Reglas de maquetación dentro del cajón:**

- `.body` lleva `flex: 1` y `min-height: 0`. Sin altura propia, un
  `margin-top: auto` dentro no tiene espacio que repartir.
- Los bloques de alto variable llevan `min-height` reservado para el peor caso
  —descripción, etiquetas y el hueco del enlace—, porque **dos de los seis
  proyectos no tienen URL** y sin reservarlo el paginador saltaba una línea.
- **En estrecho la hoja va ARRIBA, sobre el cielo, y es media pantalla.** En
  vertical el mundo ocupa solo la franja de abajo y lo de arriba está vacío.
  Estuvo abajo, al 76% del alto: tapaba el mundo entero y se quedaba con el
  dedo, así que con un panel abierto no se podía ni ver ni andar. Se
  barajaron un aviso que se abre al tocarlo, la ventana gris del juego y una
  hoja de dos alturas; quedó esta por ser arreglo y no rediseño.
- **En estrecho la hoja no desliza por dentro** (`overflow: hidden`). Estuvo
  con `overflow-y: auto`, y donde el contenido no cabía el dedo movía primero
  el panel y luego el mundo: dos scrolls encadenados, que se sienten como que
  la página se atasca antes de que el personaje avance. Así que **todo tiene
  que caber**, y un panel nuevo o más largo hay que medirlo en móvil.
- **Cada panel se aprieta para caber**, y en pantallas bajas el contenido
  entero se encoge (`zoom` en `.body`, por tramos de alto) en vez de cortarse.
  Proyectos pone la captura pequeña junto al texto (`.lead`), corta la
  descripción a cuatro líneas y las etiquetas a una fila; Sobre mí va a un
  párrafo por página (`perPage`); Skills va en dos columnas y sin la nota de
  proyectos; Hackatones deja cada evento en puesto, nombre y foto. El texto
  completo sigue en ancho y en `/simple`. Comprobado hasta 360×640.
- `Book` pagina por **tandas de párrafos** (`perPage`), no uno por página: el
  contenido se queda en párrafos semánticos porque `/simple` los quiere sueltos.

Los proyectos son un carrusel con una captura por diapositiva
(`public/projects/<id>.webp`, carga diferida). Si falta una, la diapositiva se
queda en texto sin dejar un hueco roto.

### El visor (`Lightbox.tsx`)

La captura se pulsa y se abre en grande. Comparte índice con el carrusel: lo
que se pasa en el visor es el proyecto en el que estás al cerrarlo. Está hecho
para reutilizarse con las fotos de los hackatones.

- **Va en un portal al `body`.** Los cajones llevan `translate` e `inert`, y un
  `position: fixed` dentro de un ancestro transformado se coloca respecto a
  él, no a la ventana.
- **El scroll se retiene con oyentes, no con `overflow: hidden`.** Quitar la
  barra ensancha la página y el mundo entero salta de lado. Y hay que
  retenerlo: moverlo cerraría el cajón de debajo sin que se viera.
- **Sus teclas van en captura**: las flechas también mueven el carrusel.
- **El personaje la mira contigo** (`peek_watch`, de `gen_watch.py`): sube
  por abajo en el borde izquierdo de la imagen y casi todo el tiempo solo la
  mira. Cada pocos segundos hace algo, alternando: girarse hacia ti y
  señalarla asintiendo, o quedarse pensando con la mano en la barbilla. Es
  hermano del saludo: misma cámara.
- **La hoja son cuatro tramos y el orden lo pone la página.** Entrada,
  reposo y dos gestos; cada gesto empieza y acaba en la primera pose del
  reposo, así que se encadenan como se quiera (`WATCH.loop` en
  `watchSheet.ts`, `loop` en `SpriteGrid`). Hubo un bucle único con los gestos
  seguidos: no paraba quieto y se leía como un tic. `SEGMENTS` está en el
  generador y en `watchSheet.ts`, y **tienen que coincidir**: lo vigila
  `npm test`, junto con que la hoja servida tenga la rejilla declarada.
- **En estrecho ni se monta ni se descarga**: la imagen ya ocupa toda la
  pantalla. No tiene salida propia: se va con el visor.

### Modo ligero

Se enciende solo: si el recorrido baja de 40 fps durante 120 frames **con el
mundo en marcha**, `data-lite` entra en la raíz y apaga los `filter` de las
capas, fuerza media resolución y quita el clima.

El caso que lo motiva es la aceleración por hardware desactivada. Con GPU el
filtro se aplica una vez sobre una textura y moverla sale gratis; sin ella el
navegador repinta ~43 Mpx filtrados en cada frame sobre la CPU.

**Diagnóstico por URL**, para medir en el equipo de quien lo sufre:

- `?fps` monta `PerfMeter`: FPS, peor frame y porcentaje de tirones de los
  últimos 2 s, si el modo ligero está activo, ventana y escala, y qué gráfica
  usa el navegador. Con botón para copiarlo.
- `?lite=1` fuerza el modo ligero; `?lite=0` impide que se encienda solo.
- `?tp=1` teletransporta siempre por el chat; `?tp=0`, siempre con la perla.

Medido por software (sin gráfica), parado en Inicio: 18 fps tal cual, 24 sin
clima, **59 sin los `filter` de las capas**. El JavaScript del bucle son
0,5 ms por frame: el coste es casi todo de los filtros. Dos agujeros conocidos
del disparo automático, sin arreglar: solo cuenta frames con el mundo en
marcha —llegando con la perla y quedándose quieto no salta nunca— y solo
saltaba por debajo de 30 fps, así que un equipo a 35–45 iba a tirones y no lo
recibía (ya salta por debajo de 40: `LITE_MS = 25`).

Medido en una Intel UHD real (982×727 al 125%, informe del 2026-11-16): 60
parado, 36–45 andando, 59–60 en modo ligero, 57–58 solo sin los filtros, y
picos de 100–230 ms. Con las capas a la mitad subió a 52–54 andando, y ahí
quitar los filtros ya no cambia nada medible (49–52 sin ellos, 46–54 con
ellos): **no merece la pena cocerlos en las imágenes**. Lo de 18 → 59 es de
renderizar por software, donde los filtros van por CPU. Los picos eran las
hojas del personaje decodificándose, no los biomas (ver *Hojas del
personaje*). Queda uno menor, de 100–150 ms hacia el scroll 3.000–3.250, con
y sin personaje, sin diagnosticar.

No se pregunta al navegador si la GPU está activa —no hay forma fiable— y solo
cuentan los frames en los que el mundo se mueve: parado, un frame lento no
significa nada. La noche no se pierde: pasa a un velo del tamaño de la pantalla.

### Sprites por script (`scripts/render/`)

Las seis hojas del personaje salen de aquí, no de Mine-imator: un generador o
un archivo de `poses/` da las poses y `rig.py` las renderiza con Blender sin
ventana. El comando completo está en `ASSETS.md`, en *Herramientas*.

El saludo (`peek_wave`) sube por el borde de abajo, así que `.greeter` va
centrado y pegado al fondo, y su escala la limitan el alto **y el ancho**: en
vertical, a media pantalla de alto los brazos se salían por los lados. Se sirve
a 1,5×, y `@half` por debajo de `HALF_RES_WIDTH`.

- **Positivo es siempre hacia delante**: un brazo avanza, el torso se inclina,
  la cabeza mira abajo. Las extremidades cuelgan de su pivote y el torso y la
  cabeza se apoyan en el suyo, así que la misma inclinación es la rotación
  contraria; `rig.py` lo resuelve en un solo sitio. Estuvo invertido y el
  personaje acababa mirando al suelo.
- **El asiento va adelantado**. El mundo se congela en `SIT_AT = 0.998`, no en
  1, así que el borde del cantil queda unas 5 unidades de skin por delante del
  personaje. Sentado sobre su propio eje, las espinillas colgaban sobre la
  tierra en vez de fuera.
- **El frame 1 sigue de pie y de perfil**, que es lo que alinea la hoja contra
  `idle`. La cabeza gira hacia la pantalla a mitad del gesto; el cuerpo no.
- **Antes de animar, leer `ASSETS.md` › *Cómo se mueve el personaje*.** Un
  gesto se hace calcando primero una hoja hecha a mano (`fit_pose.py` →
  `poses/*.json`) y retocando lo que le falte. Escrito por fórmula desde cero
  salió cerrado y rígido, y hubo que tirarlo.

## Contenido

`src/content/portfolio.ts`: `ABOUT_PAGES`, `PROJECTS`, `CONTACT`, `RECIPES`
(skills como recetas de crafteo), `TECH_KIND`. Separado del recorrido a
propósito — se añade un proyecto sin abrir el código de la animación.

## Trampas reales

- **`src/content/layers.ts` dice que se genera, y no del todo.**
  `scripts/import-layers.py` escribe `layers.json` y nada lo convierte a
  `.ts`: los altos se copian a mano desde ese JSON. La línea de `b2_stage` se
  añadió así. Sigue sin tocarse por intuición: el número sale de la importación.
- **El mapeo scroll↔mundo vive en `worldFromScroll` / `scrollFromWorld`.**
  Estuvo repetido en seis sitios y moverlo sin unificarlo dejó alguno atrás.
- **La entrada partida se quitó, no se perdió.** Foto y skin a pantalla
  completa, apartándose con scroll. Se revirtió en `402cd9b` porque se desplegó
  con marcadores grises; el trabajo está en `470cc76` y vuelve con
  `git revert 402cd9b` en cuanto existan la foto y el render.
- **No reintroducir Lenis ni GSAP.** Se quitaron a propósito. El mundo ya suaviza
  el scroll con su propio `current += (target - current) * easeFor(…)`, y montar Lenis
  encima hace que dos suavizados se peleen. GSAP son timelines, y aquí el scroll
  es una posición: no hay línea de tiempo que animar.
- **`ASSETS.md` manda sobre las decisiones de render.** No cambiar cámara,
  encuadre ni escala sin leerlo: varias de esas decisiones se tomaron después de
  descartar alternativas.
- **`recorrido.module.css`** es el módulo de `/`, pese al nombre: la página vivió
  en `/recorrido` antes de promocionarse a la raíz.
- **Los paneles se navegan con ratón y teclado, nunca con scroll.** El scroll
  pertenece al mundo.
- **El cofre lleva `max-width: none`.** El reset le pone `max-width: 100%` y
  su caja mide cero —los marcadores van en absoluto dentro de un contenedor
  sin ancho—, así que medía 0×0. Estuvo montado e invisible sin que nadie lo
  notara.
- **`.stage` lleva `overflow: clip`, no `hidden`.** Con `hidden` la caja sigue
  siendo desplazable, y al abrir un enlace con `#contacto` el navegador la
  corría de lado para enseñar el marcador: el mundo entero, una pantalla a la
  izquierda.
- **Las secciones se buscan por `id` (`atOf`), no por su puesto en `SECTIONS`.**
  Los paneles usaban `SECTIONS[2]` y se descolocaban al tocar la lista.
- **El `id` de Experiencias sigue siendo `proyectos`.** Cambió el rótulo; el
  ancla se quedó para no romper enlaces ya compartidos.
- **Un `<canvas>` a pantalla completa lleva `width` y `height` en CSS.**
  `inset: 0` no estira un elemento reemplazado. El de la perla medía lo que
  su mapa de bits —ventana × densidad— y en cualquier pantalla que no fuera
  1× dibujaba desplazado: al 125% de un portátil la perla salía del suelo.
  **Probar siempre también con `devicePixelRatio` distinto de 1.**
- **El suelo del acantilado se alarga hacia atrás por su terreno, no por la
  tesela** (`solid` en `Strip`). La tesela tiene suelo hasta el cantil y vacío
  transparente después. Puestas una junto a otra y espejadas, a dos teselas
  del ancla quedaban dos vacíos pegados: un tramo sin suelo. En escritorio
  caía antes de la frontera del bioma y el recorte lo tapaba; en un móvil,
  con teselas la mitad de anchas, caía dentro y se caminaba sobre la nada.
  **El suelo se monta aparte de las demás capas** (otro `Strip`, más abajo
  en `page.tsx`): un cambio a las capas hay que mirarlo en los dos sitios.
- Todo lo visible en `public/` se sirve abierto, CV incluido.

## Abierto: ideas sin decidir

Nada de esto está empezado. Queda escrito para que no se pierda entre sesiones.

### Easter egg: blackjack en el templo

Los templos del desierto del juego tienen una cámara secreta con un cofre. El
`far` de `b3` ya lleva el templo anclado, así que hay dónde colgarlo: clic en el
templo → cámara oculta → el personaje de dealer reparte.

La lógica de blackjack son ~150 líneas. El trabajo real son las cartas —en CSS,
no 52 imágenes— y el reparto. Haría falta un render del personaje con skin de
crupier.

**El contraargumento, que vale la pena recordar:** un blackjack demuestra menos
que el mundo que ya existe. Lo que sí aporta es que se note que alguien se lo
pasó bien construyendo esto.

### Dominio propio

El sitio está en Vercel y se redespliega solo con cada push a `main`. **Nunca se
configuró un dominio.** Se habló de NIC Chile y del GitHub Student Pack, sin
decidir nada.

### Entrada partida

Construida y revertida. Ver *Trampas reales*. Vuelve con un `git revert` en
cuanto existan la foto y el render de cuerpo entero.

### Perla

Hecho: sale de la mano (`THROW_RELEASE`, que mide el rig con su sonda `probe`
y hay que volver a medir si cambia la hoja `throw`), vuela en arco con
gravedad, su tamaño es proporción del alto del personaje
(`PEARL_OF_CHARACTER`) y deja una estela de partículas de portal.

**El lanzamiento tuvo dos fallos de un frame, por si vuelven:**

- La rama de la zancada del bucle corría también en `throw` y pisaba el frame
  del gesto: parado, se quedaba en el frame 1 los 700 ms.
- El efecto del gesto calculaba el tiempo con la marca del frame, que puede
  ser anterior a cuando arrancó. Tiempo negativo → frame −1 → al envolver, el
  último del gesto: un parpadeo con el brazo extendido al empezar. Y lanzando
  en marcha el nodo traía el desplazamiento de la zancada sobre la hoja nueva.
  Ahora el tiempo no baja de cero y el frame 0 se escribe en un
  `useLayoutEffect`, antes de pintar.

**La mano se sitúa midiendo la celda del sprite en pantalla**
(`getBoundingClientRect`), no deduciéndola del 20% y la línea del suelo. La
deducción no sabía nada de lo que desplaza al personaje: en el podio la perla
salía del suelo, a un lado.

**No renderizarla en 3D.** En el juego la perla lanzada es el sprite plano de
16×16 de cara a la cámara, que es lo que ya hace el sitio; en 3D sería menos
fiel. La única excepción con sentido sería la perla **en la mano** mientras
carga el lanzamiento, que hoy va vacía.

## Documentación

- **`ASSETS.md`** — producción de renders: estado de cada hoja y capa, reglas de
  cámara y encuadre, pendientes y decisiones cerradas.
- **`README.md`** — visión general para quien llega al repo.
