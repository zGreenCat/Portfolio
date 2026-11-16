'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import SpriteGrid from './SpriteGrid'
import { WATCH } from './watchSheet'
import styles from './Lightbox.module.css'

/** Alto de su celda respecto al de la ventana. */
const WATCH_VH = 0.36
/** Por debajo de este ancho no sale: la imagen ya ocupa toda la pantalla. */
const WATCH_MIN_WIDTH = 761

/** Baja la hoja antes de que haga falta, para que no asome tarde. No hace
 *  nada en pantallas donde el acompañante no sale. */
export function warmCompanion() {
  if (window.innerWidth < WATCH_MIN_WIDTH) return
  const image = new Image()
  image.src = WATCH.src
}

export interface LightboxItem {
  src: string
  alt: string
  caption: string
}

interface LightboxProps {
  items: LightboxItem[]
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}

/** Teclas con las que el navegador desplaza el documento. */
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])

/**
 * Una imagen en grande, sobre el mundo oscurecido.
 *
 * Va en un portal al `body`: los cajones llevan `translate` e `inert`, y un
 * `position: fixed` dentro de un ancestro transformado se coloca respecto a
 * él, no a la ventana.
 *
 * El scroll se retiene con oyentes, no con `overflow: hidden` en el `body`:
 * quitar la barra ensancha la página y el mundo entero da un salto de lado.
 * Y hay que retenerlo: el scroll es la posición del mundo, y moverlo con el
 * visor abierto cerraría el cajón de debajo sin que se viera.
 */
export default function Lightbox({ items, index, onIndex, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const total = items.length
  /** Escala del acompañante, o `null` si en esta pantalla no sale. */
  const [watchScale, setWatchScale] = useState<number | null>(null)

  useEffect(() => {
    const fit = () =>
      setWatchScale(
        window.innerWidth < WATCH_MIN_WIDTH
          ? null
          : (window.innerHeight * WATCH_VH) / WATCH.cellHeight,
      )
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    const step = (delta: number) => onIndex((index + delta + total) % total)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowRight' && total > 1) step(1)
      else if (event.key === 'ArrowLeft' && total > 1) step(-1)
      else if (event.key === 'Tab') {
        // El foco da la vuelta dentro del visor: detrás está todo tapado.
        const stops = boxRef.current?.querySelectorAll<HTMLElement>('button')
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
      } else if (!SCROLL_KEYS.has(event.key)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const hold = (event: Event) => event.preventDefault()
    // En captura: las flechas también mueven el carrusel de debajo, y aquí
    // tienen que mover solo el visor.
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', hold, { passive: false })
    window.addEventListener('touchmove', hold, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', hold)
      window.removeEventListener('touchmove', hold)
    }
  }, [index, total, onIndex, onClose])

  const item = items[index]
  if (!item) return null

  return createPortal(
    <div
      ref={boxRef}
      className={`${styles.veil} ${watchScale === null ? '' : styles.accompanied}`}
      role="dialog"
      aria-modal="true"
      aria-label={item.caption}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className={styles.close}
        aria-label="Cerrar"
        onClick={onClose}
      >
        ✕
      </button>

      <figure className={styles.figure} onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={item.src} src={item.src} alt={item.alt} className={styles.image} />
        <figcaption className={styles.caption}>
          <span>{item.caption}</span>
          {total > 1 ? (
            <span className={styles.count}>
              {index + 1} / {total}
            </span>
          ) : null}
        </figcaption>
      </figure>

      {watchScale === null ? null : (
        <div className={styles.companion} aria-hidden="true">
          <SpriteGrid {...WATCH} scale={watchScale} label="" />
        </div>
      )}

      {total > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            aria-label="Anterior"
            onClick={(event) => {
              event.stopPropagation()
              onIndex((index - 1 + total) % total)
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Siguiente"
            onClick={(event) => {
              event.stopPropagation()
              onIndex((index + 1) % total)
            }}
          >
            ›
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  )
}
