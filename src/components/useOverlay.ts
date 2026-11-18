'use client'

import { useEffect, useRef, type RefObject } from 'react'

/** Teclas con las que el navegador desplaza el documento. */
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

interface OverlayOptions {
  /** La caja del visor: el foco da la vuelta dentro de ella. */
  boxRef: RefObject<HTMLElement | null>
  /** Dónde cae el foco al abrir. */
  focusRef: RefObject<HTMLElement | null>
  onClose: () => void
  /** Teclas propias del visor. Devuelve true si la atendió. */
  onKey?: (key: string) => boolean
}

/**
 * Lo que comparten los visores que tapan la página: el foco entra, da la
 * vuelta dentro y vuelve a quien lo abrió; Escape cierra; y el scroll de
 * debajo se retiene.
 *
 * El scroll se retiene con oyentes, no con `overflow: hidden` en el `body`:
 * quitar la barra ensancha la página y el mundo entero da un salto de lado. Y
 * hay que retenerlo: el scroll es la posición del mundo, y moverlo con el
 * visor abierto cerraría el cajón de debajo sin que se viera.
 *
 * Lo que lleve `data-overlay-scroll` y tenga contenido que no cabe sí
 * desplaza por dentro, con rueda, dedo y teclado: la ficha de la portada, en
 * móvil o con zoom, es más larga que la pantalla.
 *
 * Las teclas van en captura: las flechas también mueven el carrusel de
 * debajo, y con el visor abierto tienen que mover solo el visor.
 */
export function useOverlay({ boxRef, focusRef, onClose, onKey }: OverlayOptions) {
  const handlers = useRef({ onClose, onKey })
  handlers.current = { onClose, onKey }

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    focusRef.current?.focus()
    return () => opener?.focus()
  }, [focusRef])

  useEffect(() => {
    /** El foco se ha ido del visor: el botón que lo tenía se desmontó —una
     *  miniatura, al pasar de ficha— y cayó en el `body`. */
    const strayed = () => !boxRef.current?.contains(document.activeElement)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlers.current.onClose()
      else if (event.key === 'Tab') {
        // El foco da la vuelta dentro del visor: detrás está todo tapado.
        const stops = boxRef.current?.querySelectorAll<HTMLElement>('button, a[href]')
        if (!stops || stops.length === 0) return
        const first = stops[0]
        const last = stops[stops.length - 1]
        // Desde fuera, Tab iba al primer control de lo que hay debajo.
        if (strayed()) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
        return
      } else if (handlers.current.onKey?.(event.key)) {
        // Atendida por el visor.
        if (strayed()) focusRef.current?.focus()
      } else if (!SCROLL_KEYS.has(event.key)) return
      // El espacio sobre un botón o un enlace lo pulsa; no es un desplazamiento.
      else if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, a')) return
      else {
        // Las teclas de desplazar no mueven lo de debajo, pero sí lo que el
        // visor tenga más largo que su caja. Estaban bloqueadas del todo, y
        // con zoom o en una pantalla baja la ficha solo se podía leer con
        // rueda o con el dedo.
        const inner = boxRef.current?.querySelector<HTMLElement>('[data-overlay-scroll]')
        if (inner && inner.scrollHeight > inner.clientHeight) {
          const page = inner.clientHeight * 0.85
          const by: Record<string, number> = {
            ArrowDown: 48,
            ArrowUp: -48,
            PageDown: page,
            PageUp: -page,
            ' ': event.shiftKey ? -page : page,
            Home: -inner.scrollHeight,
            End: inner.scrollHeight,
          }
          inner.scrollBy({ top: by[event.key] ?? 0, behavior: 'auto' })
        }
      }
      event.preventDefault()
      event.stopPropagation()
    }
    const hold = (event: Event) => {
      const inside =
        event.target instanceof Element ? event.target.closest('[data-overlay-scroll]') : null
      if (inside && inside.scrollHeight > inside.clientHeight) return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('wheel', hold, { passive: false })
    window.addEventListener('touchmove', hold, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('wheel', hold)
      window.removeEventListener('touchmove', hold)
    }
  }, [boxRef, focusRef])
}
