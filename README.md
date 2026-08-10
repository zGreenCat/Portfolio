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
Los biomas no ocupan un tramo cada uno: los cinco cubren el mundo entero y se
funden por opacidad, lo que evita tener que empalmar terrenos.

**Los paneles se abren por proximidad**, con histéresis para que un roce de
rueda no los haga parpadear. Y se navegan **con ratón y teclado, nunca con
scroll** — el scroll pertenece al mundo.

**La perla de ender** salta entre secciones. El corte de scroll ocurre mientras
la perla está fuera de pantalla, así que no hay nada que disimular.

## Estructura

```
src/app/page.tsx            el recorrido completo
src/app/recorrido.module.css
src/components/             personaje, paneles, perla, cielo
src/content/portfolio.ts    proyectos, sobre mí, skills, contacto
public/layers/              capas de mundo por bioma (b1…b5)
public/sprites/             hojas de sprites del personaje
```

El contenido está separado del recorrido a propósito: se puede añadir un
proyecto sin abrir el código de la animación.

## Assets

Los renders se producen en Mine-imator. Las reglas de cámara, encuadre,
montaje de hojas y los pendientes están en **[ASSETS.md](./ASSETS.md)**.
