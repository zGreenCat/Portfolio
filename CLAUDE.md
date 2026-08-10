# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

```bash
npm run dev     # dev server con Turbopack (http://localhost:3000)
npm run build   # build de producción con Turbopack
npm run start   # servir el build
npx tsc --noEmit  # type-check (no hay script definido)
```

No hay linter ni suite de tests configurados en el proyecto.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4 + GSAP/ScrollTrigger + Lenis.

Tailwind v4 se configura desde CSS (`@import "tailwindcss"` en `src/app/globals.css`) — no existe `tailwind.config.js`. Los colores de marca son variables CSS en `:root` (`--color-bg`, `--color-cream`, `--color-green`, `--color-dark-green`, `--color-brown`) con utilidades manuales en `@layer utilities`; buena parte del código usa hex literales en clases arbitrarias (`text-[#4A5E52]`) en vez de esas utilidades.

Alias de imports: `@/*` → `./src/*`.

## Arquitectura

Toda la página vive en `src/app/page.tsx` (client component único, ~500 líneas): navbar, hero animado, carrusel de proyectos y spacer final. No hay directorio `src/components/`.

### La animación del hero

El hero es **un solo `ScrollTrigger`** con `pin: true` y `end: '+=5000'`. No usa tweens de GSAP: todo se calcula dentro de `onUpdate(self)` a partir de `self.progress` (0→1) y se aplica escribiendo `style.opacity` / `style.filter` / `style.transform` directamente sobre nodos DOM. Cambiar el timing significa tocar los umbrales numéricos dentro de ese `onUpdate`, no una timeline.

Fases sobre `progress`:

| Rango | Qué pasa |
|-------|----------|
| 0 → 0.35 | Letras de `greeting` se revelan una a una (blur 8px→0, opacity 0.4→1) |
| 0.35 → 0.45 | Fade out del greeting (blur 0→8px) |
| 0.25 / 0.5 / 0.75 | Entra imagen 2 / 3 / 4; la anterior queda como "sombra" (opacity 0.3, brightness 0.5) |
| 0.5 → 1.0 | Letras del párrafo `about` se revelan igual que la fase 1 |

Las letras se generan imperativamente en el `useEffect`: cada carácter se convierte en un `<span>` (espacio → ` `) inyectado en `textRef` / `aboutTextRef`, que en el JSX son un `<h1>` y un `<p>` vacíos. El efecto depende de `[lang]`, así que cambiar idioma reconstruye todos los spans.

### Textos e i18n

`texts` es un objeto literal `{ es, en }` dentro del componente; `lang` es estado local con un toggle en el navbar. No hay librería de i18n. Los textos de proyectos se interpolan con ternarios sobre `lang`. `projectsData` son placeholders, no proyectos reales.

## Trampas conocidas del código actual

- **`LenisProvider` (`src/providers/LenisProvider.tsx`) no está montado.** `layout.tsx` no lo envuelve, así que el smooth scroll no está activo pese a que el CSS de Lenis sí está en `globals.css`. Si se conecta, va en `layout.tsx` alrededor de `{children}`.
- **`src/utils/splitText.ts` está sin usar.** `page.tsx` duplica esa lógica inline.
- **El cleanup del `useEffect` de la animación nunca corre.** El `return` con `ctx.revert()` está dentro del callback del `setTimeout`, no en el cuerpo del efecto, así que los ScrollTrigger se acumulan en cada cambio de `lang`.
- **`layout.tsx` conserva el metadata de create-next-app** (`title: "Create Next App"`).
- Hay `console.log` de debug activos en el `onUpdate` del ScrollTrigger y en `LenisProvider` (uno por evento de scroll).

## Documentación del repo: obsoleta

`IMPLEMENTATION.md` y `ANIMATION_LOGIC.md` describen una arquitectura de componentes (`IntroSection.tsx`, `SplitLetters.tsx`, `Navbar.tsx`, `ProjectsSection.tsx`, `PortfolioPage.tsx`) que **no existe** y una lógica de animación con tweens `gsap.to` + múltiples ScrollTriggers que fue reemplazada por el `onUpdate` manual. `ANIMATION_LOGIC.md` además documenta un bug que ya no aplica. Tratarlos como historia de diseño, no como referencia. `README.md` es el boilerplate de create-next-app.

`IMAGES_NEEDED.md` sí es válido: las 4 imágenes de `public/intro/` ya están puestas.
