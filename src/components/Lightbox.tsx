'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import SpriteGrid from './SpriteGrid'
import { useOverlay } from './useOverlay'
import { WATCH } from './watchSheet'
import styles from './Lightbox.module.css'

/** Alto de su celda respecto al de la ventana. */
const WATCH_VH = 0.36
/** Por debajo de este ancho la imagen ocupa toda la pantalla y él no cabe a
 *  su lado: asoma por la esquina de abajo, más pequeño. */
const WATCH_MIN_WIDTH = 761
/** Ancho de su celda respecto al de la ventana, en estrecho. */
const WATCH_NARROW_VW = 0.6

const isNarrow = () => window.innerWidth < WATCH_MIN_WIDTH

/** Baja la hoja antes de que haga falta, para que no asome tarde. */
export function warmCompanion() {
  const image = new Image()
  image.src = isNarrow() ? WATCH.halfSrc : WATCH.src
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

/**
 * Una imagen en grande, sobre el mundo oscurecido.
 *
 * Va en un portal al `body`: los cajones llevan `translate` e `inert`, y un
 * `position: fixed` dentro de un ancestro transformado se coloca respecto a
 * él, no a la ventana.
 *
 * El foco, las teclas y el scroll retenido los lleva `useOverlay`, que
 * comparte con el visor de la portada.
 */
export default function Lightbox({ items, index, onIndex, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const total = items.length
  /** El acompañante: a qué escala va y si es la pantalla estrecha. `null`
   *  hasta medir la ventana. */
  const [watch, setWatch] = useState<{ scale: number; narrow: boolean } | null>(null)

  useEffect(() => {
    const fit = () => {
      const narrow = isNarrow()
      setWatch({
        narrow,
        scale: narrow
          ? (window.innerWidth * WATCH_NARROW_VW) / WATCH.cellWidth
          : (window.innerHeight * WATCH_VH) / WATCH.cellHeight,
      })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useOverlay({
    boxRef,
    focusRef: closeRef,
    onClose,
    onKey: (key) => {
      if (total <= 1) return false
      if (key === 'ArrowRight') onIndex((index + 1) % total)
      else if (key === 'ArrowLeft') onIndex((index - 1 + total) % total)
      else return false
      return true
    },
  })

  const item = items[index]
  if (!item) return null

  return createPortal(
    <div
      ref={boxRef}
      className={`${styles.veil} ${watch === null ? '' : styles.accompanied}`}
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

      {watch === null ? null : (
        <div className={styles.companion} aria-hidden="true">
          <SpriteGrid
            {...WATCH}
            src={watch.narrow ? WATCH.halfSrc : WATCH.src}
            scale={watch.scale}
            label=""
          />
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
