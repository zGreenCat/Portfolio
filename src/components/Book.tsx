'use client'

import { useEffect, useState } from 'react'

import Panel from './Panel'
import styles from './Book.module.css'

interface BookProps {
  title: string
  /** Párrafos sueltos. La paginación la decide este componente, no el
   *  contenido: `/simple` los quiere todos seguidos y aquí van por tandas. */
  pages: string[]
  /** Cuántos párrafos caben en una vuelta. En el cajón lateral entran de
   *  sobra tres; en el libro pequeño de antes solo cabía uno. */
  perPage?: number
  /** Retrato del autor, en su marco de ranura. */
  portrait?: { src: string; alt: string }
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia. */
  openness: number
}

/**
 * Texto largo, paginado.
 *
 * Se pasa de página con botones, no con scroll — el scroll pertenece al mundo.
 * Por eso el texto va troceado en páginas cortas en vez de en un bloque que
 * haya que recorrer.
 */
export default function Book({ title, pages, portrait, perPage = 3, openness }: BookProps) {
  const [page, setPage] = useState(0)

  const groups: string[][] = []
  for (let i = 0; i < pages.length; i += perPage) groups.push(pages.slice(i, i + perPage))
  const shown = groups[Math.min(page, groups.length - 1)] ?? []

  // Al alejarse se cierra y vuelve a la primera página.
  useEffect(() => {
    if (openness < 0.15) setPage(0)
  }, [openness])

  return (
    <Panel eyebrow="Quién soy" title={title} openness={openness}>
      {portrait ? (
        <span className={styles.portrait}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portrait.src} alt={portrait.alt} className={styles.portraitImage} />
        </span>
      ) : null}

      <div className={styles.text}>
        {shown.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
      </div>

      {groups.length > 1 ? (
      <div className={styles.footer}>
        <span className={styles.page}>
          {page + 1} / {groups.length}
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
            onClick={() => setPage((p) => Math.min(groups.length - 1, p + 1))}
            disabled={page === groups.length - 1}
          >
            Siguiente ›
          </button>
        </div>
      </div>
      ) : null}
    </Panel>
  )
}
