'use client'

import { useCallback, type MouseEvent } from 'react'

import { ARRIVAL_KEY, type Arrival } from '@/world/fallIn'

/** Lo que dura el salto fuera de la isla; el mismo que `leap` en el CSS. */
const LEAP_MS = 950

interface LostWaysProps {
  className: string
  primaryClass: string
  secondClass: string
}

/**
 * Las dos salidas de la 404. Se va como llegó: se tira de la isla, y el mundo
 * lo recibe cayendo del cielo en Inicio —y con la portada encima, si eso
 * pidió—. Adónde va queda anotado en `sessionStorage`; lo lee `layout.tsx`
 * antes de pintar.
 *
 * Sin JavaScript, o con una tecla modificadora, son dos enlaces normales.
 */
export default function LostWays({ className, primaryClass, secondClass }: LostWaysProps) {
  const leave = useCallback((event: MouseEvent<HTMLAnchorElement>, arrival: Arrival) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    const scene = event.currentTarget.closest('[data-end]')
    if (!(scene instanceof HTMLElement)) return
    event.preventDefault()
    if (scene.dataset.leaving) return
    try {
      window.sessionStorage.setItem(ARRIVAL_KEY, arrival)
    } catch {
      // Sin almacenamiento se llega igual, por la portada de siempre.
    }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scene.dataset.leaving = 'true'
    window.setTimeout(() => window.location.assign('/'), still ? 0 : LEAP_MS)
  }, [])

  return (
    <nav className={className} aria-label="Salidas">
      {/* Enlaces de verdad y no `Link`: la vuelta es una carga entera, que
          es la pantalla de carga entre una dimensión y otra. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className={primaryClass} onClick={(event) => leave(event, 'portada')}>
        Volver a la portada
      </a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/#inicio" className={secondClass} onClick={(event) => leave(event, 'mundo')}>
        Recorrer el mundo
      </a>
    </nav>
  )
}
