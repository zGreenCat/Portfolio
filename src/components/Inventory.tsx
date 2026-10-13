'use client'

import { useEffect, useRef, useState } from 'react'

import Panel from './Panel'
import styles from './Inventory.module.css'

export interface Project {
  id: string
  name: string
  summary: string
  description: string
  tags: string[]
  url?: string
  /** Captura del proyecto, 16:9. Opcional: sin ella la diapositiva se queda en
   *  texto, sin dejar un hueco roto. Así se pueden ir añadiendo de una en una. */
  shot?: string
}

interface InventoryProps {
  title: string
  projects: Project[]
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia al cofre. */
  openness: number
}

/**
 * Los proyectos, uno por diapositiva.
 *
 * Las ranuras del cofre siguen aquí, pero **como paginador**: marcan en cuál
 * estás y saltan a cualquiera. Antes eran una rejilla que había que abrir para
 * ver nada; así conservan la metáfora del inventario y encima sirven.
 *
 * Se navega con botones y teclado, **nunca con scroll**: el scroll pertenece al
 * mundo y disputárselo rompería el recorrido.
 */
export default function Inventory({ title, projects, openness }: InventoryProps) {
  const [index, setIndex] = useState(0)
  /** Capturas que no existen todavía. Las rutas van cableadas desde el
   *  contenido, así que basta con soltar el archivo para que aparezca; hasta
   *  entonces la diapositiva se queda en texto en vez de enseñar un roto. */
  const [missing, setMissing] = useState<Record<string, true>>({})
  const slotsRef = useRef<HTMLDivElement>(null)

  // Al alejarse, el panel se cierra y vuelve al primero.
  useEffect(() => {
    if (openness < 0.15) setIndex(0)
  }, [openness])

  const total = projects.length
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total)

  // Flechas para moverse entre proyectos, como en el libro.
  useEffect(() => {
    if (openness <= 0.9) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openness, total])

  const project = projects[index]
  if (!project) return null

  return (
    <Panel
      eyebrow={`Proyecto ${index + 1} de ${total}`}
      title={project.name}
      role="dialog"
      openness={openness}
    >
      {project.shot && !missing[project.id] ? (
        <span className={styles.shot}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.shot}
            alt={`Captura de ${project.name}`}
            className={styles.shotImage}
            loading="lazy"
            decoding="async"
            onError={() => setMissing((m) => ({ ...m, [project.id]: true }))}
          />
        </span>
      ) : (
        /* Sin captura, el hueco se conserva y dice por qué. Una diapositiva más
           corta entre otras seis se lee como un fallo; esto se lee como un dato. */
        <span className={`${styles.shot} ${styles.noShot}`}>
          <span className={styles.noShotText}>Producto interno · sin demo pública</span>
        </span>
      )}

      <p className={styles.summary}>{project.summary}</p>
      <p className={styles.description}>{project.description}</p>

      <ul className={styles.tags}>
        {project.tags.map((tag) => (
          <li key={tag} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>

      <span className={styles.linkSlot}>
        {project.url ? (
          <a className={styles.open} href={project.url} target="_blank" rel="noreferrer noopener">
            Abrir proyecto ↗
          </a>
        ) : null}
      </span>

      <div className={styles.pager}>
        <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="Anterior">
          ‹
        </button>

        {/* Las ranuras del cofre, ahora como indicador de posición. */}
        <div className={styles.slots} ref={slotsRef} role="tablist" aria-label={title}>
          {projects.map((item, slot) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={slot === index}
              aria-label={item.name}
              className={`${styles.slot} ${slot === index ? styles.current : ''}`}
              onClick={() => setIndex(slot)}
            >
              <span className={styles.pip} />
            </button>
          ))}
        </div>

        <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="Siguiente">
          ›
        </button>

        <span className={styles.count}>
          {index + 1} / {total}
        </span>
      </div>
    </Panel>
  )
}
