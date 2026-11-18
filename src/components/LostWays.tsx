'use client'

import { useCallback, useEffect, type MouseEvent } from 'react'

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
    // Al enlace tal cual, con su ancla si la lleva: sin almacenamiento,
    // «Recorrer el mundo» tiene que seguir llevando al mundo.
    const href = event.currentTarget.href
    window.setTimeout(() => window.location.assign(href), still ? 0 : LEAP_MS)
  }, [])

  // Quien vuelve aquí con «atrás» puede recuperar la página tal como la
  // dejó, a medio salto: los enlaces no responderían, y la llegada anotada
  // haría caer del cielo a la siguiente visita. Se deshacen las dos cosas.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      document.querySelectorAll<HTMLElement>('[data-end][data-leaving]').forEach((scene) => {
        delete scene.dataset.leaving
      })
      try {
        window.sessionStorage.removeItem(ARRIVAL_KEY)
      } catch {
        // Sin almacenamiento no quedó nada anotado.
      }
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
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
