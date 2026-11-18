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
`characterSheets.ts`, `coverSheet.ts`, `works.ts`, `smoothing.ts`, `teleport.ts`,
`walkSpeed.ts` y los de `src/world/` que no son hooks): la lógica
que merezca test se saca a un módulo así. El aviso de `MODULE_TYPELESS` al
correrlos es inofensivo; no añadir `"type": "module"` al `package.json`.

**Un módulo que los tests importan y que importa a otro lo hace con ruta
relativa y extensión** (`'./constants.ts'`): Node no resuelve el alias `@/` ni
adivina la extensión. Por eso `tsconfig.json` lleva
`allowImportingTsExtensions`. Los hooks y componentes, que los tests no
tocan, siguen con `@/`.

**Para comprobar que un cambio que solo mueve código no cambió nada:
`scripts/dev/smoke.mjs`.** Recorre el mundo por puntos fijos en tres pantallas
—escritorio, portátil al 125% y móvil— y anota dónde queda cada capa, cada
cajón y el personaje, sentado y en el podio incluidos:
`node scripts/dev/smoke.mjs antes.json`, hacer el cambio, y
`node scripts/dev/smoke.mjs despues.json antes.json`. Tarda unos cuatro
minutos y necesita el servidor de desarrollo. Compara con 12 px de margen:
el mundo se congela al sentarse en el frame en que llega, y entre dos pasadas
iguales baila unos píxeles. No mide lo que corre por tiempo (reposo, clima)
ni bajar del podio andando.

**Para probar sin navegador a mano: `scripts/dev/browse.mjs`.** Abre el
sitio en Chromium sin ventana, a la ventana y densidad que se le pida,
ejecuta un script en la página y opcionalmente guarda una captura:
`node scripts/dev/browse.mjs 400x820 2 1 '<js>' [captura.png]`. Renderiza por
software: vale para posiciones y tamaños, no para medir rendimiento.

**No lances `npm run build` con `npm run dev` corriendo**: comparten `.next` y el
resultado son 500 hasta que se borra el directorio.

## Dónde vive

`https://vicente-araya.dev`, en Vercel, que redespliega solo con cada push a
`main`. El dominio está registrado en Cloudflare (2026-11-18), y con Cloudflare
como registrador **el DNS se queda en Cloudflare**: no se pueden pasar los
servidores de nombres a Vercel.

- Dos registros, los dos en «DNS only» (nube gris): un `A` para la raíz y un
  `CNAME` para `www`, con los valores que da Vercel en *Domains*. **Con el
  proxy de Cloudflare encendido** Vercel no valida el dominio ni emite el
  certificado.
- `www.vicente-araya.dev` redirige a la corta con un 308, **desde Vercel**. No
  añadir además una regla de redirección en Cloudflare: quedarían dos
  encadenadas.
- La dirección pública para las previsualizaciones de enlace sale de la
  variable `NEXT_PUBLIC_SITE_URL` de Vercel (`layout.tsx`). Sin ella, la
  imagen de Open Graph apunta a la dirección interna de cada despliegue.
- **El correo del sitio es `hola@vicente-araya.dev`**, que Cloudflare (Email
  Routing) reenvía al correo personal de Vicente. Solo recibe: las respuestas
  salen desde su correo de siempre. El personal no va en el código ni en el
  sitio; estuvo, y sigue en el historial de git anterior al 2026-11-18. El
  dominio lleva SPF y DMARC en `quarantine`, no `reject`: si algún día se
  envía desde el dominio, con `reject` rebotarían sus propios correos hasta
  ajustarlo.
- **El CV en PDF sí lleva su correo personal y su teléfono**, a propósito:
  Vicente considera `hola@` la dirección comercial del sitio y quiere la
  personal en el CV. Es un archivo aparte (`public/cv-vicente-araya.pdf`),
  exportado de un Word suyo en Drive; se reemplaza conservando el nombre,
  que es el que ya circula en enlaces.

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
| `/` | La portada, y detrás el mundo recorrible. Client component. |
| `/simple` | Redirige a `/` (`next.config.ts`). Fue la versión en texto. |

**El contenido va en el HTML servido gracias a la portada.** En el mundo los
paneles se montan al acercarse caminando, así que por sí solo no sirve ningún
proyecto: buscadores, previsualizaciones de enlace y lectores de pantalla no
verían nada. Eso lo cubría `/simple`; ahora lo cubre la portada, que se pinta
también en el servidor. Portada y mundo leen de `@/content/portfolio`, así que
el texto se toca en un solo sitio.

## La portada (`Cover.tsx`)

Lo primero que se ve. Nació de que el sitio se sentía «demasiado Minecraft» y
poco de Vicente: quien no caminaba no veía su trabajo, y quien sí, veía sobre
todo bloques. La pantalla va **partida en diagonal**: papel a la izquierda,
mundo a la derecha, su nombre cruzando la costura —negro sobre el papel,
blanco sobre el mundo— y él y su avatar justo en el corte, en la misma
postura y con el mismo polerón. Al bajar, el contenido sube encima como un
telón: una presentación corta, experiencia, proyectos, hackatones, stack,
sobre mí y contacto.

El «sobre mí» va partido (`COVER_ABOUT`). Entero antes de los proyectos eran
seis párrafos por delante de lo que el visitante vino a ver; entero al final,
del arranque se saltaba al trabajo sin decir quién es. Arriba van los dos
primeros párrafos, en letra grande y sin título; abajo, junto al contacto,
cómo trabaja y qué busca. El párrafo que enumera proyectos no sale en la
portada: los tiene justo debajo.

- **El trabajo va en dos niveles: una línea en la lista y el resto en una
  ficha.** Los proyectos son un índice —una fila por proyecto, y la fila
  entera abre su ficha— y los hackatones un podio plano, 2.º, 1.º, 3.º, con
  una línea del metal de cada puesto y la foto encima. La descripción completa
  va en la página aunque se vea recortada: es lo que leen buscadores y
  lectores de pantalla. Antes eran dos rejillas de tarjetas iguales.
- **Proyectos y hackatones van separados**, a petición de Vicente: un hackatón
  es un logro y un proyecto es un trabajo. Hubo una maqueta que los juntaba en
  una sola lista. Solo se tocan donde coinciden: la ficha de un proyecto que
  salió de un podio enlaza con él, y al revés (`jump` en `works.ts`). Dentro
  del visor las flechas no salen de su sección.
- **Sin rótulo pequeño encima de los títulos.** Los llevó toda la portada
  («HACKATONES», «PROYECTOS»…) y se quitaron: es un tic de plantilla, y el
  título se basta.
- **Es una hoja encima del mundo real, no otra página.** Lo que se ve por la
  diagonal es el mundo de verdad, montado detrás y quieto. Con dos rutas, el
  mundo de la portada sería una copia que habría que calzar al píxel con el
  real justo al entrar. «Recorrer el mundo» aparta la hoja —la diagonal barre
  hacia el lado— y no hay cambio de página.
- **Tiene su propio scroll** (`position: fixed`, `overflow-y: auto`). El
  scroll del documento es la posición del mundo y no se comparte. Mientras
  está puesta, el `body` no desplaza y `.stage` va `inert`.
- **La rueda va suavizada a mano**, con `easeFor`, como el mundo: manda un
  destino y la hoja lo alcanza. Con ratón el navegador la movía a saltos.
  Solo la rueda —dedo, teclado y barra van por el navegador— y no con Lenis,
  por lo mismo que se quitó del mundo.
- **El mundo espera detrás.** La carga termina en la fase `waiting`; el
  saludo y la entrada caminando arrancan al apartar la portada (`begin`,
  `enterWorld`). Hubo una versión que se saltaba el saludo al venir de la
  portada y se echó de menos.
- **Con ancla se llega directo al mundo.** `/#contacto` no enseña portada:
  la esconde el CSS con `:has(:target)` antes de que React arranque, y
  después la desmonta la página. Por eso **dentro de la portada no hay
  enlaces con ancla**: `:target` la escondería a ella misma. «Ver mi trabajo»
  desplaza por código. Los `id` de sus títulos van con prefijo `portada-`
  para no chocar con los marcadores de sección del mundo.
- **Se vuelve a ella con `/tp portada`, siempre** (`tpToCover`, botón
  «Portada» de la barra): se deshace en el mundo y el segundo estallido cae
  sobre su avatar de la portada, que entra barriendo al revés (`arrives`).
  Ponerla encima sin más se veía como un corte. Por eso el canvas de la perla
  va por encima de la portada, y dónde cae el estallido se mide en el nodo
  (`data-cover-avatar`) con la portada ya montada (`flushSync`). El mundo
  regresa al inicio —a medio camino podía quedar un cajón abierto asomando
  por la diagonal— y el personaje del mundo no se pinta hasta volver a
  entrar. El primer elemento enfocable la pone de golpe, sin gesto.
- **El avatar está vivo** (`duo`, de `gen_duo.py`): siete poses sueltas, cinco
  miradas y dos de parpadeo. Sigue al puntero y parpadea por su cuenta,
  escribiendo al nodo, sin estado. Qué pose toca lo decide `coverSheet.ts`,
  con tests. La hoja se recorta a la caja común de las siete poses, así que
  **su celda cambia si cambia la skin o la pose**: `render_all.sh` imprime la
  medida y hay que copiarla a `DUO`; el test lo vigila.
- **Los dos van recortados como una pegatina**: contorno claro y filo oscuro
  alrededor de la silueta de ambos (`drop-shadow` encadenados). Es lo que
  hace que una foto y un muñeco de bloques se lean como una sola cosa.
- **«Recorrer el mundo» es un tirador sobre la costura**: una pastilla clara,
  en el hueco entre el nombre y sus cabezas. Fue un botón oliva abajo a la
  derecha y pasaba desapercibido: pequeño, en la esquina que menos se mira y
  del color de la tierra. Sobre la diagonal dice con su sitio lo que hace
  —mueve esta línea—; suelto de ella sería un botón más. Para abrirle hueco,
  la foto y el avatar se achicaron un 14%.
  Su sitio se mide (`knobSpot`, en `coverSheet.ts`): el nombre crece con el
  ancho y ellos con el alto, así que el hueco cambia con la forma de la
  ventana. Se da tres empujones al entrar y se queda quieto; en bucle cansaba.
- **En vertical la diagonal se tumba**: papel arriba con el nombre, mundo
  abajo con los dos. Las cifras no salen, y el tirador va centrado sobre la
  costura, que ahí pasa por la media de `--cut-a` y `--cut-b`.
- **La foto (`public/vicente.webp`) se sirve abierta**, como todo `public/`.
  Es un recorte sin fondo; el original no está en el repo.
- **La experiencia es una línea de tiempo** (`EXPERIENCE`, en
  `portfolio.ts`): una línea fina, un círculo por año —relleno donde algo
  sigue hoy— y el año en grande, con lo que empezó ese año debajo. Sale del
  CV de Vicente, con los cargos acortados y una línea por cargo; si cambia el
  CV, cambia eso. La forma la eligió él entre siete, a partir de referencias
  suyas. Agrupa por el año en que EMPEZÓ cada cosa: lo que cruza de año lleva
  «hoy» en oliva.
- **Este sitio va como un proyecto más** (`SITE_PROJECT`), el último del
  índice, con enlace al repositorio. Fue una sección propia, «El mundo
  también es ingeniería», con tres cifras grandes: hablaba de la página y no
  de él, y repetía la entrada al mundo. Solo sale en la portada, no en el
  cofre del mundo.

## Arquitectura del mundo

`src/app/page.tsx` es el estado, el bucle y el montaje. Lo demás está
repartido, y lo que se calcula no vive en React:

| Dónde | Qué |
|---|---|
| `src/world/constants.ts` | Medidas: secciones, velocidades, umbrales, cada uno con su porqué |
| `src/world/geometry.ts` | Territorio de cada bioma, en cuál estás, apertura de paneles |
| `src/world/gait.ts` | La marcha y la zancada |
| `src/world/gestures.ts` | Sentarse y subir al podio, como pasos puros |
| `src/world/podium.ts` | Tablas y saltos del podio |
| `src/world/air.ts` | Qué clima cae y con cuánta fuerza |
| `src/world/useWorldRefs.ts` | Las cuarenta refs que comparten los hooks, en un objeto |
| `src/world/useViewport.ts` | Lo que sale del tamaño de la ventana |
| `src/world/useWorldLoop.ts` | **El bucle** |
| `src/world/usePlacement.ts` | `placeWorld` y la entrada caminando |
| `src/world/useSprite.ts` | `writeFrame`, el reposo y el lanzamiento |
| `src/world/useEntry.ts` | Portada, carga y reaterrizaje: en qué fase arranca el mundo |
| `src/world/useLoading.ts` | Pantalla de carga y descarga en segundo plano |
| `src/world/useTeleport.ts` | Perla, `/tp` y vuelta a la portada |
| `src/components/WorldLayers.tsx` | Capas del fondo, suelo y escenario |
| `src/components/WorldChrome.tsx` | Barra, pantalla de carga y calentado de hojas |

Fue un solo componente de 2.240 líneas; hoy la página son unas 465. Al
partirlo se movió el código tal cual, un paso por commit, comparando el mundo
con `smoke.mjs` tras cada uno. Tres cosas que explican la forma que tiene:

- **Las refs viajan juntas** (`useWorldRefs`). Todo lo que cambia por frame
  vive en refs, y las comparten casi todos los hooks: una a una eran una
  treintena de argumentos. Cada hook recibe el objeto y saca las que usa. El
  objeto es nuevo en cada render y las refs no: no va en dependencias.
- **El estado de los gestos sigue en refs**: `gestures.ts` recibe el estado,
  devuelve el nuevo y dice qué tiene que atender el bucle (clavar el mundo,
  mover el scroll).
- **Los hooks se llaman en un orden que importa**: `useViewport` antes que
  nada, `useEntry` antes que `useTeleport` —que necesita `landingFor` y
  `openCover`—, y `hidden` vive en la página porque lo tocan los dos.

Las reglas que siguen hablan de «el bucle»: es el efecto de
`useWorldLoop.ts`.

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

### Claro y oscuro: la hora del día (`daylight.ts`)

El mundo tiene una sola «hora», de 0 (día) a 1 (noche), y de ella cuelgan el
cielo, las estrellas, lo que se oscurece el terreno y la luz del farol. **El
tema oscuro no pinta nada: recorre esa escala al revés.**

- Claro: de día casi todo el recorrido, y anochece hacia el acantilado.
- Oscuro: de noche casi todo el recorrido, y **amanece** hacia el acantilado.
  No llega a pleno día: se queda en `DAWN`, el punto del cielo anaranjado, y
  sale un sol cuadrado por donde de noche está la luna.

Decisiones:

- **Por defecto, claro, y no sigue al sistema.** Vicente lo pidió así: es como
  se diseñó el sitio. Se elige con el interruptor —arriba a la derecha en la
  portada, junto a «Sonido» en la barra del mundo— y se recuerda en este
  navegador (`localStorage`, clave `tema`).
- **La foto y el avatar no cambian** con el tema, ni su contorno claro.
- El tema va en `data-theme` de la raíz del documento, no de la página: el
  visor de la portada es un portal y cuelga del `body`.
- `placeWorld` lee el tema de una ref (`themeRef`); al cambiarlo se vuelve a
  colocar el mundo donde está, y no se reinicia el bucle.
- De rendimiento no cuesta: el filtro de las capas está siempre puesto, de
  día también; la noche solo le cambia los valores.

Con el oscuro puesto, quien recarga ve un instante el claro: el tema guardado
se lee al montar, y la página se sirve en claro.

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

**La frontera con el acantilado cae en un claro, no a mitad de camino.** El
recorte duro partía árboles en dos, y ahí se notaba: son los cerezos más
grandes y en primer plano. Tres piezas, las tres en función del tamaño de la
tesela, que cambia con la pantalla:

- **Solo si hay un claro entre las dos secciones.** Con teselas de escritorio
  (unos 3.100 px a 1080 de alto) no cae ninguno entre Skills y Contacto, y la
  frontera se queda a medio camino, donde puede partir un árbol. Se vio al
  escribir los tests de `makeBounds`; está sin arreglar.
- `makeBounds` pone esa frontera en un claro del suelo del acantilado (donde
  se juntan dos de sus copias por el extremo sin árbol), el más cercano a la
  mitad entre las dos secciones.
- El suelo de los cerezos se corre (`phase` en `Strip`, `clearingPhase`) para
  que su propio claro caiga en esa misma frontera.
- Su capa `near` también, pero su recorte se desliza sobre ella al andar —va
  a otro ritmo que el suelo—, así que el claro se centra en mitad de ese
  deslizamiento y cabe entero.

Las capas del fondo siguen cortándose, pero van con niebla y no se nota. **Las
demás fronteras no están tratadas**: si alguna parte un árbol, es esto mismo.

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
legible y se les acorta el poste.

**Van junto al cantil, a la izquierda de donde se sienta, con un farol.**
Estuvieron en el `at` de la sección, bajo el árbol grande, y tenían dos
problemas: de noche eran lo más oscuro del cuadro, y al sentarse —él camina
hasta el borde y el mundo se desplaza— quedaban fuera de la pantalla en
cualquier equipo. En el final del recorrido no había ningún enlace a la
vista.

- Su ancla es el borde derecho de la fila (`signsAnchor`, en `geometry.ts`),
  pegado al sitio donde se sienta; la fila crece hacia la izquierda.
- **A Contacto se aterriza a media pantalla del cantil** (`contactLanding`),
  no en el `at` de la sección: en un móvil los carteles quedaban una pantalla
  más allá de donde caía.
- **La farola** (`props.py lamp`) es como las que se construyen en el juego:
  base de piedra, poste de tablas, travesaño oscuro bajo una losa y un farol
  colgando de cada punta. Va **detrás de los carteles, en el centro de la
  fila**, y es simétrica por eso. Fue un poste liso con un solo farol al
  final de la fila; a Vicente le pareció poco. Sus dos halos crecen con la
  noche y van por delante de los carteles; por eso ya casi no se oscurecen.
- **En un móvil van de dos en dos, apilados**, como se apilan en el juego:
  a la izquierda del asiento solo caben dos. Los de arriba son solo la tabla.
  El farol asoma por detrás.

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
- **Teclea como esté** (`typingSheet`). De pie, la hoja `type`: el reposo con
  la cabeza baja y las manos delante, hecha sobre `poses/idle.json`. Sentado
  en el cantil, `typeSit`, sobre el último frame de `sit` para que el cuerpo
  no se mueva al empezar. En el primer puesto, `typePodium`, de cara y con la
  medalla. Las tres salen de `gen_type.py` y comparten el tecleo. Hubo un
  tiempo en que sentado y en el podio se quedaba quieto, y se leía como que
  el comando no hacía nada. A medio gesto —sentándose, subiendo— no cambia
  de hoja: es un instante y no hay pose que case.
- **No hay vuelo que tape el corte.** Lo tapa que entre los dos estallidos no
  hay personaje (`blink` en `EnderPearl`): desaparece a los 110 ms de enviar
  y reaparece a los 320.
- **El bioma de destino se decodifica desde que se pide** (`warmAtRef`), para
  la perla también. Sin eso, con el comando se llegaba a un cielo pelado: el
  vuelo de la perla daba medio segundo de margen y aquí no lo hay.
- **`Chat.tsx` está partido en barra de entrada y registro** a propósito. Hoy
  la barra se escribe sola; el día que escriba el visitante se cambia por un
  campo de texto y lo demás vale.

### Irse volando a un enlace de fuera (`useFlight.ts`)

Al pulsar el cartel de GitHub o el de LinkedIn el personaje saca un cohete,
abre los élitros, lo enciende y sale volando; al salir de la pantalla, la
página navega al enlace.

- **Navega en esta pestaña y al terminar el gesto**, no al pulsar. Lo eligió
  Vicente entre tres salidas. En una pestaña nueva el navegador se lleva al
  visitante en el acto y el vuelo no se ve; abrirla después del gesto es una
  ventana emergente, que se bloquea. Con una tecla modificadora el enlace se
  abre como siempre, y con movimiento reducido también.
- **Solo esos dos carteles.** El correo abre el programa de correo y el CV se
  descarga: no hay adónde volar.
- **La hoja (`fly`, de `gen_fly.py`) va dibujada en el sitio** y lo que se
  desplaza lo pone la página (`flight.ts`, con tests), como en el podio. El
  sprite se mueve con `translate`: el bucle le escribe el `transform` al
  contenedor en cada frame y esa es otra propiedad.
- **Va como un teletransporte** (`teleportingRef`): el bucle no le elige
  marcha ni lo gira, y no le escribe el frame de la zancada.
- **En el aire gira unos 20° hacia la cámara.** De perfil puro las alas
  quedan de canto: dos rayas.
- **Las alas se abren de lado y quedan tendidas a lo largo de la espalda**,
  desde la cintura. Abiertas hacia atrás se levantaban por encima de él: con
  el cuerpo inclinado, «atrás» es «arriba» en la pantalla. Costó tres
  intentos; el primero solo bajaba el punto del que salían.
- Los élitros y el cohete están dibujados en `rig.py`, no salen de texturas
  del juego: una pose los enseña con `elytra`, `wings` (0 plegadas … 1
  abiertas) y `rocket`.
- **`FIRE` está en el generador y en `flight.ts` y tienen que coincidir**: es
  la pose en la que el cohete deja la mano y la página suelta las chispas. Lo
  vigila `npm test`.
- Quien vuelve con «atrás» puede recuperar la página con el personaje fuera
  de la pantalla: `pageshow` lo devuelve a su sitio.
- **Sentado en el cantil, primero se pone de pie**: la hoja de sentarse al
  revés (`standFrame`), y luego despega. Es el caso normal —los carteles
  quedan junto al asiento— y sin esto saltaba de sentado a de pie de golpe.
  Mientras se levanta, `stateRef` ya dice `fly` para que el bucle no le
  escriba el frame, y el nodo sigue enseñando la hoja `sit`.

### En pantallas táctiles se anda con botones (`WalkPad.tsx`)

Donde el puntero es un dedo (`pointer: coarse`) el scroll no se suelta nunca
(`overflow: hidden` en el `body`) y abajo a la derecha hay dos botones, ◀ y ▶.
Mantener pulsado anda y, pasado medio segundo, corre (`walkSpeed`).

El recorrido sigue siendo el scroll del documento: los botones lo mueven por
código con `scrollBy`, así que secciones, paneles, sentarse y el podio no se
enteran. Se cambió porque deslizar con el dedo se sentía raro: el navegador
mueve primero su propia página —esconde la barra de direcciones, arrastra con
inercia— y solo después avanzaba el personaje. Con ratón no cambia nada.

La velocidad va en anchos de pantalla por segundo, no en bloques: en un móvil
el mundo es pequeño y a ritmo de bloques cruzarlo llevaba un minuto.

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
  completo sigue en ancho y en la portada. Comprobado hasta 360×640.
- `Book` pagina por **tandas de párrafos** (`perPage`), no uno por página: el
  contenido se queda en párrafos semánticos porque la portada los quiere sueltos.

Los proyectos son un carrusel con una captura por diapositiva
(`public/projects/<id>.webp`, carga diferida). Si falta una, la diapositiva se
queda en texto sin dejar un hueco roto.

### Dos visores, una base (`useOverlay.ts`)

El del mundo (`Lightbox`) agranda una imagen y nada más: el cajón ya cuenta
el proyecto. El de la portada (`WorkViewer`) lleva además la ficha —título,
para quién, descripción completa, tecnologías, demo— porque ahí la lista solo
enseña una línea. No es uno con opciones: el de la portada tiene ficha, tira
de imágenes, la imagen que viaja y navegación por sección, y meterlo en el
otro lo dejaba el doble de grande y lleno de condiciones.

Lo delicado lo comparten en `useOverlay`: el foco entra, da la vuelta y
vuelve a quien abrió; Escape; las teclas en captura; y el scroll retenido con
oyentes. Un bloque con `data-overlay-scroll` sí desplaza por dentro si su
contenido no cabe: la ficha, en móvil.

En `WorkViewer`:

- **Lo único que se mueve es la imagen.** Sale de su sitio en la lista, crece
  hasta el marco y al cerrar vuelve a la fila de lo que se estaba mirando.
  Es una copia suelta que cuelga del `body`, medida a mano de caja a caja; no
  usa las transiciones de vista del navegador, que no están en todos.
- **El marco toma la forma exacta de la imagen** (`fitFrame`): la copia llega
  a esa caja, y con otra proporción daría un salto al asentarse. Por eso cada
  imagen declara su `ratio`: capturas 16:9, fotos 3:2, y la que no lo es lo
  dice en `portfolio.ts`. Lo comprueba `npm test` contra los archivos.
- **Qué fichas hay, su orden y adónde llevan las flechas** está en
  `works.ts`, sin React y con tests.
- **Sin personaje acompañante.** En el mundo vienes caminando con él; aquí el
  tono es otro.

### El visor del mundo (`Lightbox.tsx`)

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
- **En estrecho asoma por la esquina de abajo a la izquierda**, bajo la
  imagen, más pequeño (60% del ancho) y con la hoja a la mitad
  (`peek_watch@half`): la entera son 50 MB decodificada y en un teléfono va
  encima del mundo. Estuvo sin montarse en móvil porque no cabe al lado de la
  imagen; Vicente lo echó en falta. Las flechas, que iban centradas abajo, se
  fueron a la derecha para dejarle sitio, y el velo es más opaco ahí: debajo
  quedan los botones de andar. No tiene salida propia: se va con el visor.

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

Las catorce hojas del personaje salen de aquí, no de Mine-imator: un generador o
un archivo de `poses/` da las poses y `rig.py` las renderiza con Blender sin
ventana. **`scripts/render/render_all.sh` las rehace todas** desde
`public/skin.png` en minuto y medio, con sus `@half`.

**El personaje es Vicente, no un panda.** La skin la dibuja
`scripts/render/gen_skin.py` —pelo oscuro rizado, lentes de ceja, sombra de
barba, polerón oliva de cuello redondo con su parche, collar con la luna y
cargo café, como en la foto de la portada— y escribe también el
retrato de «Sobre mí» (`avatar.png`). Es un script y no un PNG pintado a mano
para que cambiar un color sea editarlo y volver a lanzar `render_all.sh`. El
panda queda en `scripts/render/skin-panda.png`. Decisiones que costaron:

- **El pelo va en la capa de la cabeza**; la de fuera solo lleva mechones
  sueltos. Con todo el pelo fuera la cabeza entera se inflaba como un casco.
  Arriba no hay mechones: esa capa son planos sin grosor y de canto eran
  rayitas flotando.
- **Para que no parezca Steve**: flequillo que tapa la frente, sin nariz ni
  perilla marrón, barba solo en sombra. Los lentes son la fila de arriba del
  ojo; con aro entero se comían la cara, que mide ocho píxeles.
- **La capa de fuera lleva lo que abulta**: cuello, puños y elástico del
  polerón; pretina, bajo y bolsillos del cargo.

**Los ojos se mueven** (`rig.py`, *Eyes that move*). La skin pinta el ojo
entero en blanco y la pupila es una pieza aparte que se desliza; un párpado
baja para parpadear. Una pose los mueve con `eyes` (−1…1) y `blink` (0…1).
Solo se usan en los primeros planos —el saludo parpadea, el del visor mira la
imagen y vuelve a ti—: en las hojas del mundo la pupila mide un píxel. En el
visor **el reposo no parpadea**: es un tramo que se repite y sería un
parpadeo por segundo.

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
- **La entrada partida acabó siendo la portada.** Hubo una primera versión
  —foto y skin a pantalla completa, apartándose con scroll— que se revirtió
  en `402cd9b` porque se desplegó con marcadores grises. No hay que
  recuperarla: `Cover.tsx` es esa idea, hecha con la foto y el render reales.
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

### Lo que queda de partir `page.tsx`

Hecho casi todo (ver *Arquitectura del mundo*). Quedan dos cosas menores:

- **Los marcadores de sección y los paneles** siguen en el árbol de la
  página, unas 150 líneas de JSX. Saldrían a un componente; no se hizo
  porque la página ya se lee entera.
- **`useWorldLoop` son casi 500 líneas, con un solo efecto.** Lo que calcula ya está
  fuera y probado; lo que queda es el orden y las escrituras al DOM. Se
  podría trocear por tramos (encuadre, paneles, precalentado), con cuidado:
  comparten variables del cierre (`current`, `target`, `cycle`).
- El reaterrizaje al recargar (`armResume`) no lo cubre `smoke.mjs`: su
  navegador no recarga la página.

### Cambiar uno de los dos biomas de cerezos

Skills (`b4`) y Contacto (`b5`) son los dos de cerezos. Los demás biomas
cambian de tipo en cada frontera, y ahí un corte duro se lee como en el juego;
entre estos dos, al ser el mismo paisaje, el corte se ve como un fallo. En
escritorio además puede partir un árbol (ver *Capas y biomas*). Idea de
Vicente: que uno de los dos sea otro bioma, en vez de seguir afinando la
frontera. Pide renders nuevos de las capas de ese bioma.

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
