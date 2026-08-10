'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

import styles from './SpriteGrid.module.css'

interface SpriteGridProps {
  src: string
  /** Tamaño de celda en píxeles de origen. */
  cellWidth: number
  cellHeight: number
  columns: number
  rows: number
  frames: number
  fps: number
  scale: number
  /** Se dispara al llegar al último frame. La reproducción se detiene ahí. */
  onFinish?: () => void
  label: string
}

/**
 * Reproduce una hoja en rejilla una sola vez. Las hojas largas no caben en
 * tira horizontal — 37 celdas de 435 px serían 16 000 px de textura — así que
 * van en rejilla y hay que avanzar en dos ejes.
 */
export default function SpriteGrid({
  src,
  cellWidth,
  cellHeight,
  columns,
  rows,
  frames,
  fps,
  scale,
  onFinish,
  label,
}: SpriteGridProps) {
  const [frame, setFrame] = useState(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrame(frames - 1)
      onFinish?.()
      return
    }

    const start = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const index = Math.floor(((now - start) / 1000) * fps)
      if (index >= frames - 1) {
        setFrame(frames - 1)
        if (!finishedRef.current) {
          finishedRef.current = true
          onFinish?.()
        }
        return
      }
      setFrame(index)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frames, fps, onFinish])

  // Redondeado a entero: con anchos fraccionarios el borde de cada celda cae
  // a medio píxel y se cuela una franja de la celda vecina. Esa era la raya.
  const width = Math.round(cellWidth * scale)
  const height = Math.round(cellHeight * scale)

  return (
    <div
      className={styles.sprite}
      role="img"
      aria-label={label}
      style={
        {
          width,
          height,
          backgroundImage: `url(${src})`,
          backgroundSize: `${width * columns}px ${height * rows}px`,
          backgroundPositionX: `${-(frame % columns) * width}px`,
          backgroundPositionY: `${-Math.floor(frame / columns) * height}px`,
        } as CSSProperties
      }
    />
  )
}
