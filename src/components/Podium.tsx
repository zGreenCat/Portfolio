'use client'

import { useEffect, useState } from 'react'

import { EVENTS, PLACE_LABEL, PROJECTS, eventThumb } from '@/content/portfolio'

import Lightbox, { warmCompanion } from './Lightbox'
import Panel from './Panel'
import styles from './Podium.module.css'

interface PodiumProps {
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia. */
  openness: number
}

const METAL = { 1: styles.gold, 2: styles.iron, 3: styles.copper } as const

const liveUrl = (projectId?: string) =>
  projectId ? PROJECTS.find((project) => project.id === projectId)?.url : undefined

/**
 * Hackatones, como los enseña el podio del mundo: los tres con puesto, cada
 * uno con el metal de su escalón, y aparte lo que se hizo sin subir.
 *
 * Lo de fuera del podio va como logro del juego. Es la forma que tiene
 * Minecraft de decir «hiciste esto» sin decir «ganaste», y ponerle medalla
 * sería lo único falso del cajón.
 */
const MEDAL_PIXELS: ReadonlyArray<readonly [x: number, y: number, width: number, colour: string]> = [
  [0, 0, 2, '#c71a1f'], [7, 0, 2, '#c71a1f'],
  [1, 1, 2, '#c71a1f'], [6, 1, 2, '#c71a1f'],
  [2, 2, 2, '#c71a1f'], [5, 2, 2, '#c71a1f'],
  [3, 3, 3, '#c71a1f'],
  [3, 4, 3, '#c78f14'],
  [2, 5, 5, '#c78f14'], [3, 5, 3, '#ffcc2e'],
  [1, 6, 7, '#c78f14'], [2, 6, 5, '#ffcc2e'], [3, 6, 1, '#fff29e'],
  [1, 7, 7, '#c78f14'], [2, 7, 5, '#ffcc2e'], [3, 7, 1, '#fff29e'],
  [1, 8, 7, '#c78f14'], [2, 8, 5, '#ffcc2e'],
  [2, 9, 5, '#c78f14'], [3, 9, 3, '#ffcc2e'],
  [3, 10, 3, '#c78f14'],
]

/** La medalla del personaje, en plano: los colores son los de la pieza del rig. */
export function PodiumMedal() {
  return (
    <svg viewBox="0 0 9 11" shapeRendering="crispEdges" aria-hidden="true">
      {MEDAL_PIXELS.map(([x, y, width, colour], index) => (
        <rect key={index} x={x} y={y} width={width} height={1} fill={colour} />
      ))}
    </svg>
  )
}

export default function Podium({ openness }: PodiumProps) {
  /** Las fotos de un evento, abiertas en el visor. */
  const [viewing, setViewing] = useState<{ id: string; index: number } | null>(null)

  // Al bajar del podio se cierra el cajón, y con él lo que hubiera abierto.
  useEffect(() => {
    if (openness < 0.15) setViewing(null)
  }, [openness])

  const open = openness > 0.9
  useEffect(() => {
    if (open) warmCompanion()
  }, [open])

  const shown = viewing ? EVENTS.find((event) => event.id === viewing.id) : undefined

  const placed = EVENTS.filter((event) => event.place !== null).sort(
    (a, b) => (a.place ?? 0) - (b.place ?? 0),
  )
  const others = EVENTS.filter((event) => event.place === null)

  return (
    <Panel eyebrow="Podio" title="Hackatones" openness={openness} narrow="top" slim>
      <ol className={styles.places}>
        {placed.map((event) => {
          const url = liveUrl(event.project)
          return (
            <li key={event.id} className={styles.place}>
              <span className={`${styles.medal} ${METAL[event.place as 1 | 2 | 3]}`} aria-hidden="true">
                {event.place}
              </span>
              <div className={styles.text}>
                <p className={styles.rank}>{PLACE_LABEL[event.place as 1 | 2 | 3]}</p>
                <h3 className={styles.name}>
                  {event.name} <span className={styles.year}>{event.year}</span>
                </h3>
                <p className={styles.summary}>{event.summary}</p>
                {url ? (
                  <a className={styles.link} href={url} target="_blank" rel="noreferrer noopener">
                    Ver lo que se construyó
                  </a>
                ) : null}
              </div>
              {event.photos && event.photos.length > 0 ? (
                <button
                  type="button"
                  className={styles.photo}
                  aria-label={`Ver las ${event.photos.length} fotos de ${event.name} ${event.year}`}
                  onClick={() => setViewing({ id: event.id, index: 0 })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={eventThumb(event.id)} alt="" loading="lazy" decoding="async" />
                  <span className={styles.count} aria-hidden="true">
                    {event.photos.length}
                  </span>
                </button>
              ) : null}
            </li>
          )
        })}
      </ol>

      {others.length > 0 ? (
        <ul className={styles.others}>
          {others.map((event) => {
            const url = liveUrl(event.project)
            return (
              <li key={event.id} className={styles.advancement}>
                <p className={styles.unlocked}>¡Logro desbloqueado!</p>
                <h3 className={styles.name}>
                  {event.name} <span className={styles.year}>{event.year}</span>
                </h3>
                <p className={styles.summary}>{event.summary}</p>
                {url ? (
                  <a className={styles.link} href={url} target="_blank" rel="noreferrer noopener">
                    Ver lo que se construyó
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {viewing && shown?.photos ? (
        <Lightbox
          items={shown.photos.map((photo) => ({
            src: photo.src,
            alt: photo.alt,
            caption: `${shown.name} ${shown.year}`,
          }))}
          index={viewing.index}
          onIndex={(index) => setViewing({ id: viewing.id, index })}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </Panel>
  )
}
