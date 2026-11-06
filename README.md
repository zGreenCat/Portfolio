# Portfolio · Vicente Araya

Portfolio recorrible con estética de Minecraft. En vez de secciones apiladas,
el sitio es **un mundo continuo** que se recorre de izquierda a derecha: el
scroll desplaza el mundo y las secciones son lugares dentro de él.

```bash
npm run dev     # http://localhost:3000
npm run build
npx tsc --noEmit
```

## Cómo funciona

**El scroll es una posición, no una línea de tiempo.** Una sola
correspondencia `scroll → worldX` mueve las capas a distinta velocidad
(parallax) y decide qué está abierto. No hay disparadores ni estado que
sincronizar: todo es función de dónde estás.

**Las secciones son lugares.** Cada una tiene su bioma y su posición (`at`).
Cada bioma se **recorta a su territorio** en vez de fundirse con el vecino:
fundir por opacidad mostraba los dos terrenos a la vez —cactus sobre cerezos— y
dejaba pasar el cielo, porque dos capas al 50% componen un 75% y no un 100%. La
frontera dura tampoco es una concesión: en el juego los biomas cambian de golpe.

**Cada bioma tiene su clima.** Nieve en la taiga, tormenta de arena en el
desierto, pétalos en los cerezos. Partículas en canvas con profundidad, que el
avance del mundo arrastra. La tormenta además quita visibilidad al fondo, y
respira: en las calmas asoma el templo.

**Los paneles se abren por proximidad**, con histéresis para que un roce de
rueda no los haga parpadear. Van en un cajón a la derecha, con el mundo
oscurecido detrás: centrados tapaban al personaje justo al llegar a la sección.
Se navegan **con ratón y teclado, nunca con scroll** — el scroll pertenece al
mundo.

**El recorrido acaba sentado en el acantilado.** Es lo único que no es una
posición: el gesto va por tiempo y el mundo se congela mientras dura, así que
al retroceder el personaje se levanta antes de empezar a desplazarse.

**La perla de ender** salta entre secciones. El corte de scroll ocurre mientras
la perla está fuera de pantalla, así que no hay nada que disimular.

**El bucle no pasa por React.** Todo lo que cambia cada frame —posición del
mundo, recortes, frame del sprite, clima— se escribe al DOM por referencias.
Como estado, React reconciliaba el árbol entero sesenta veces por segundo.

**Hay un modo ligero que se enciende solo.** Si el recorrido baja de 30 fps
—el caso típico es la aceleración por hardware desactivada— apaga los filtros
de las capas, fuerza media resolución y quita el clima. Sin GPU, esos filtros
obligan a repintar decenas de megapíxeles en cada frame.

## Dos rutas

`/` es el mundo. **`/simple` es el mismo contenido en texto**, como server
component y sin JavaScript propio.

No es un plan B estético. En `/` los paneles se montan al acercarse caminando,
así que el HTML servido no contiene ningún proyecto: buscadores,
previsualizaciones de enlace y lectores de pantalla no veían nada. Las dos rutas
leen del mismo archivo de contenido.

## Estructura

```
src/app/page.tsx            el recorrido completo
src/app/recorrido.module.css
src/app/simple/             versión en texto
src/components/             personaje, paneles, perla, cielo, clima
src/content/portfolio.ts    proyectos, sobre mí, skills, contacto
src/content/layers.ts       generado — alto de cada capa y escala
scripts/import-layers.py    recorta y codifica los renders
public/layers/              capas de mundo por bioma (b1…b5)
public/sprites/             hojas de sprites del personaje
public/projects/            capturas de los proyectos
public/fonts/               Space Grotesk (SIL OFL), servida propia
```

El contenido está separado del recorrido a propósito: se puede añadir un
proyecto sin abrir el código de la animación.

## Assets

Los renders se producen en Mine-imator, todos al mismo lienzo de 3840×3000, y
`scripts/import-layers.py` los recorta y codifica. Las reglas de cámara,
encuadre, montaje de hojas, la tubería de importación y los pendientes están en
**[ASSETS.md](./ASSETS.md)**.

La arquitectura por dentro, y las trampas que ya costaron una vez, en
**[CLAUDE.md](./CLAUDE.md)**.
