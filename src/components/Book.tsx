'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import styles from './Book.module.css'

interface BookProps {
  title: string
  pages: string[]
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia. */
  openness: number
}

/**
 * Libro escrito: la interfaz del juego para leer texto largo.
 *
 * Se pasa de página con botones, no con scroll — el scroll pertenece al mundo.
 * Por eso el texto va troceado en páginas cortas en vez de en un bloque que
 * haya que recorrer.
 */
export default function Book({ title, pages, openness }: BookProps) {
  const [page, setPage] = useState(0)

  // Al alejarse se cierra y vuelve a la primera página.
  useEffect(() => {
    if (openness < 0.15) setPage(0)
  }, [openness])

  if (openness <= 0.01) return null

  const style: CSSProperties = {
    opacity: openness,
    scale: `${0.94 + openness * 0.06}`,
    pointerEvents: openness > 0.9 ? 'auto' : 'none',
  }

  return (
    <div className={styles.book} style={style} role="region" aria-label={title}>
      <span className={styles.title}>{title}</span>
      <p className={styles.text}>{pages[page]}</p>
      <div className={styles.footer}>
        <span className={styles.page}>
          {page + 1} / {pages.length}
        </span>
        <div className={styles.turns}>
          <button
            type="button"
            className={styles.turn}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            ‹ Anterior
          </button>
          <button
            type="button"
            className={styles.turn}
            onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={page === pages.length - 1}
          >
            Siguiente ›
          </button>
        </div>
      </div>
    </div>
  )
}
