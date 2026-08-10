# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev       # dev server con Turbopack
npm run build     # build de producción
npm run start     # servir el build
npx tsc --noEmit  # type-check (no hay script definido)
```

No hay linter propio ni tests. `npm run build` sí pasa ESLint.

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

Cada bioma (`b1`…`b5`) tiene hasta cuatro capas en `public/layers/`. Se montan
solo los biomas dentro de `MOUNT_RADIUS`: una capa de 3840×1440 ocupa ~21 MB
descomprimida y cinco biomas a la vez matan un móvil. Por debajo de
`HALF_RES_WIDTH` (900 px) se usan las variantes `@half`.

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
  frame más tarde, y `run` (367 px, 16 celdas) y `walk` (399 px, 25) tienen
  distinto ancho de celda, así que el desplazamiento caía entre dos celdas y se
  veían dos poses a la vez.
- **Lo que sí es estado** va cuantizado: `NIGHT_STEPS = 24`, `PANEL_STEPS = 20`.
  La noche mueve un `filter` CSS sobre superficies del ancho del mundo, y
  re-filtrar eso por frame era carísimo.

En reposo el ciclo lo lleva el CSS (`data-driven` ausente → animación activa).
El bucle **no** debe escribir el frame en `idle`.

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

## Contenido

`src/content/portfolio.ts`: `ABOUT_PAGES`, `PROJECTS`, `CONTACT`, `RECIPES`
(skills como recetas de crafteo), `TECH_KIND`. Separado del recorrido a
propósito — se añade un proyecto sin abrir el código de la animación.

## Trampas reales

- **Código muerto del portfolio anterior:** `src/providers/LenisProvider.tsx` y
  `src/utils/splitText.ts` no los importa nadie, y `gsap`, `lenis` y
  `@studio-freight/lenis` siguen en `package.json` sin usarse.
- **`ASSETS.md` manda sobre las decisiones de render.** No cambiar cámara,
  encuadre ni escala sin leerlo: varias de esas decisiones se tomaron después de
  descartar alternativas.
- **`recorrido.module.css`** es el módulo de `/`, pese al nombre: la página vivió
  en `/recorrido` antes de promocionarse a la raíz.
- **Los paneles se navegan con ratón y teclado, nunca con scroll.** El scroll
  pertenece al mundo.
- Todo lo visible en `public/` se sirve abierto, CV incluido.

## Documentación

- **`ASSETS.md`** — producción de renders: estado de cada hoja y capa, reglas de
  cámara y encuadre, pendientes y decisiones cerradas.
- **`README.md`** — visión general para quien llega al repo.
