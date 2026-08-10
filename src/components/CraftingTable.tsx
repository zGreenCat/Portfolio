'use client'

import { useEffect, useState, type CSSProperties } from 'react'

import { RECIPES, TECH_KIND } from '@/content/portfolio'

import styles from './CraftingTable.module.css'

interface CraftingTableProps {
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia. */
  openness: number
}

/**
 * Mesa de crafteo: las tecnologías como ingredientes y lo que construyen como
 * resultado.
 *
 * Sale de los stacks reales de los proyectos. Una lista plana de iconos no
 * dice nada; una receta cuenta qué combina con qué y para qué sirve.
 *
 * Se navega con ratón y teclado, nunca con scroll: el scroll mueve el mundo.
 */
export default function CraftingTable({ openness }: CraftingTableProps) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    if (openness < 0.15) {
      setIndex(0)
      setHovered(null)
    }
  }, [openness])

  if (openness <= 0.01) return null

  const recipe = RECIPES[index]
  const style: CSSProperties = {
    opacity: openness,
    scale: `${0.94 + openness * 0.06}`,
    pointerEvents: openness > 0.9 ? 'auto' : 'none',
  }

  return (
    <div className={styles.panel} style={style} role="region" aria-label="Skills">
      <span className={styles.title}>Mesa de crafteo · Skills</span>

      <div className={styles.bench}>
        <div className={styles.grid}>
          {recipe.grid.map((tech, slot) => (
            <button
              key={slot}
              type="button"
              className={`${styles.slot} ${tech ? styles.filled : ''}`}
              disabled={!tech}
              aria-label={tech ?? 'Hueco vacío'}
              onMouseEnter={() => setHovered(slot)}
              onMouseLeave={() => setHovered((c) => (c === slot ? null : c))}
              onFocus={() => setHovered(slot)}
              onBlur={() => setHovered((c) => (c === slot ? null : c))}
            >
              {tech ? (
                <span className={`${styles.item} ${styles[TECH_KIND[tech] ?? 'infra']}`}>
                  {tech}
                </span>
              ) : null}
              {tech && hovered === slot ? <span className={styles.tooltip}>{tech}</span> : null}
            </button>
          ))}
        </div>

        <span className={styles.arrow} aria-hidden="true">
          ▶
        </span>

        <div className={styles.result}>
          <span className={styles.resultItem}>{recipe.result}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.note}>{recipe.note}</span>
        <div className={styles.turns}>
          <button
            type="button"
            className={styles.turn}
            onClick={() => setIndex((i) => (i - 1 + RECIPES.length) % RECIPES.length)}
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.turn}
            onClick={() => setIndex((i) => (i + 1) % RECIPES.length)}
          >
            ›
          </button>
        </div>
      </div>
    </div>
  )
}
