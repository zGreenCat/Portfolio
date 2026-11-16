'use client'

import { useCallback, useEffect, useRef } from 'react'

import { walkSpeed } from './walkSpeed'
import styles from './WalkPad.module.css'

interface WalkPadProps {
  /** Píxeles de scroll por segundo andando y corriendo. */
  walk: number
  run: number
}

/**
 * Dos botones para andar, en pantallas táctiles.
 *
 * El recorrido es el scroll del documento, y en un móvil eso se sentía raro:
 * el navegador mueve primero su propia página —esconde la barra de
 * direcciones, arrastra con inercia— y solo después avanza el personaje. Aquí
 * el dedo no desliza nada: mantiene pulsado y el personaje anda. Por debajo
 * sigue siendo scroll, movido por código, así que todo lo demás —secciones,
 * paneles, sentarse— funciona igual.
 */
export default function WalkPad({ walk, run }: WalkPadProps) {
  const heldRef = useRef<{ direction: number; since: number } | null>(null)
  const rafRef = useRef(0)
  const speedsRef = useRef({ walk, run })
  speedsRef.current = { walk, run }

  const stop = useCallback(() => {
    heldRef.current = null
    cancelAnimationFrame(rafRef.current)
  }, [])

  const start = useCallback(
    (direction: number) => {
      stop()
      heldRef.current = { direction, since: performance.now() }
      let last = performance.now()
      const step = (now: number) => {
        const held = heldRef.current
        if (!held) return
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
        last = now
        const speed = walkSpeed((now - held.since) / 1000, speedsRef.current.walk, speedsRef.current.run)
        window.scrollBy(0, held.direction * speed * dt)
        rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [stop],
  )

  // Si el dedo se va fuera, la pestaña pierde el foco o gira la pantalla, se para.
  useEffect(() => {
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      stop()
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
    }
  }, [stop])

  const hold = (direction: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      // Con captura, levantar el dedo fuera del botón también lo suelta. Si el
      // navegador no la concede, se anda igual: lo cubren los otros avisos.
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {}
      start(direction)
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onKeyDown: (event: React.KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
        event.preventDefault()
        start(direction)
      }
    },
    onKeyUp: stop,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  })

  return (
    <div className={styles.pad}>
      <button type="button" className={styles.key} aria-label="Retroceder" {...hold(-1)}>
        ◀
      </button>
      <button type="button" className={styles.key} aria-label="Avanzar" {...hold(1)}>
        ▶
      </button>
    </div>
  )
}
