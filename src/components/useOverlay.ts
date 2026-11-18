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
 * desplaza por dentro: la ficha de la portada, en móvil, es más larga que la
 * pantalla.
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlers.current.onClose()
      else if (event.key === 'Tab') {
        // El foco da la vuelta dentro del visor: detrás está todo tapado.
        const stops = boxRef.current?.querySelectorAll<HTMLElement>('button, a[href]')
        if (!stops || stops.length === 0) return
        const first = stops[0]
        const last = stops[stops.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
        return
      } else if (handlers.current.onKey?.(event.key)) {
        // Atendida por el visor.
      } else if (!SCROLL_KEYS.has(event.key)) return
      // El espacio sobre un botón o un enlace lo pulsa; no es un desplazamiento.
      else if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, a')) return
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
  }, [boxRef])
}
