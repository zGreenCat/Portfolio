'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

import styles from './Inventory.module.css'

export interface Project {
  id: string
  name: string
  summary: string
  description: string
  tags: string[]
  url?: string
  icon?: string
}

interface InventoryProps {
  title: string
  projects: Project[]
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia al cofre. */
  openness: number
}

/** Cofre sencillo de Minecraft: 27 huecos. Los vacíos dicen "cabe más". */
const SLOTS = 27
const COLUMNS = 9

/**
 * Inventario del cofre. Se navega **con el ratón y el teclado, nunca con
 * scroll**: el scroll pertenece al mundo, y disputárselo rompería el recorrido.
 * Por eso la rejilla es de tamaño fijo y el detalle sustituye a la rejilla en
 * vez de alargar el panel.
 */
export default function Inventory({ title, projects, openness }: InventoryProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const [selected, setSelected] = useState<Project | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Al alejarse, el panel se cierra y no debe recordar la selección.
  useEffect(() => {
    if (openness < 0.15) {
      setSelected(null)
      setHovered(null)
    }
  }, [openness])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  if (openness <= 0.01) return null

  const moveFocus = (from: number, delta: number) => {
    const next = from + delta
    if (next < 0 || next >= SLOTS) return
    const button = gridRef.current?.querySelectorAll('button')[next]
    if (button instanceof HTMLElement) button.focus()
  }

  const style: CSSProperties = {
    opacity: openness,
    scale: `${0.94 + openness * 0.06}`,
    pointerEvents: openness > 0.9 ? 'auto' : 'none',
  }

    // Hasta que no está abierto del todo no se puede usar con el ratón
    // (`pointerEvents: none`), pero sus botones seguían en el orden de
    // tabulación desde el 2% de apertura: con teclado se entraba en un panel
    // fantasma. `inert` lo saca del tab y del árbol de accesibilidad.
  return (
    <div
      className={styles.panel}
      style={style}
      role="dialog"
      aria-label={title}
      inert={openness <= 0.9}
    >
      {selected ? (
        <div className={styles.detail}>
          <span className={styles.title}>{title}</span>
          <h3 className={styles.detailName}>{selected.name}</h3>
          <p className={styles.detailText}>{selected.description}</p>
          <div className={styles.tags}>
            {selected.tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className={styles.actions}>
            {selected.url ? (
              <a className={styles.button} href={selected.url} target="_blank" rel="noreferrer">
                Abrir proyecto
              </a>
            ) : null}
            <button type="button" className={styles.button} onClick={() => setSelected(null)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <>
          <span className={styles.title}>{title}</span>
          <div className={styles.grid} ref={gridRef}>
            {Array.from({ length: SLOTS }, (_, index) => {
              const project = projects[index]
              return (
                <button
                  key={index}
                  type="button"
                  className={`${styles.slot} ${project ? styles.filled : ''}`}
                  disabled={!project}
                  aria-label={project ? project.name : 'Hueco vacío'}
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered((current) => (current === index ? null : current))}
                  onClick={() => project && setSelected(project)}
                  onKeyDown={(event) => {
                    const map: Record<string, number> = {
                      ArrowRight: 1,
                      ArrowLeft: -1,
                      ArrowDown: COLUMNS,
                      ArrowUp: -COLUMNS,
                    }
                    const delta = map[event.key]
                    if (delta === undefined) return
                    event.preventDefault()
                    moveFocus(index, delta)
                  }}
                >
                  {project ? (
                    project.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.icon} alt="" className={styles.icon} />
                    ) : (
                      <span className={styles.placeholderIcon} />
                    )
                  ) : null}

                  {project && hovered === index ? (
                    <span className={styles.tooltip}>
                      <span className={styles.tooltipName}>{project.name}</span>
                      <span className={styles.tooltipMeta}>{project.summary}</span>
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          <span className={styles.hint}>Pasa el ratón · clic para abrir</span>
        </>
      )}
    </div>
  )
}
