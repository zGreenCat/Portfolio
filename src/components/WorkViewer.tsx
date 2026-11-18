'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { PLACE_LABEL } from '@/content/portfolio'

import { useOverlay } from './useOverlay'
import { fitFrame, position, sibling, type Work } from './works'
import styles from './WorkViewer.module.css'

/** Lo que tarda la imagen en viajar entre la lista y el visor. */
const FLIGHT_MS = 500
/** Fundido al pasar de una ficha a otra sin cerrar. */
const SWAP_MS = 150
/** Alto que se le deja a la tira de imágenes, bajo el marco. */
const STRIP_SPACE = 68
/** Por debajo de este ancho la ficha va debajo de la imagen. */
const NARROW = 720
/** En estrecho la imagen no pasa de esta fracción del alto. */
const NARROW_IMAGE = 0.42

const PLACE_CLASS: Record<1 | 2 | 3, string> = { 1: styles.gold, 2: styles.iron, 3: styles.copper }

interface WorkViewerProps {
  works: readonly Work[]
  id: string
  onChange: (id: string) => void
  onClose: () => void
  /** El nodo de la lista del que sale, y al que vuelve, la imagen de una ficha. */
  thumbOf: (id: string) => HTMLElement | null
}

type Stage = 'arriving' | 'open' | 'leaving'

/**
 * El visor de la portada: la imagen en grande y, a su lado, la ficha.
 *
 * La lista enseña una línea de cada trabajo y aquí está el resto, para quien
 * se interesa. El del mundo (`Lightbox`) no lleva ficha porque allí el cajón
 * ya lo cuenta; los dos comparten `useOverlay`.
 *
 * Lo único que se mueve es la imagen: sale de su sitio en la lista, crece
 * hasta el marco y al cerrar vuelve. Dice de dónde salió lo que se está
 * mirando. Va medida a mano —de dónde sale, adónde llega— y no con las
 * transiciones de vista del navegador, que no están en todos.
 */
export default function WorkViewer({ works, id, onChange, onClose, thumbOf }: WorkViewerProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<Stage>('arriving')
  const [swapping, setSwapping] = useState(false)
  const [seen, setSeen] = useState({ id, shot: 0 })
  const stageRef = useRef<Stage>('arriving')
  stageRef.current = stage

  const work = works.find((candidate) => candidate.id === id)
  if (!work) throw new Error(`WorkViewer: no hay ninguna ficha «${id}»`)
  // Al cambiar de ficha se vuelve a su primera imagen.
  const shotIndex = seen.id === id ? seen.shot : 0
  const shot = work.shots[shotIndex]
  const where = position(works, id)

  /** El marco toma la forma de la imagen, tan grande como quepa. */
  const fit = useCallback(() => {
    const figure = figureRef.current
    const frame = frameRef.current
    if (!figure || !frame || !shot) return
    const box = figure.getBoundingClientRect()
    const narrow = window.innerWidth <= NARROW
    const size = fitFrame(
      shot.ratio,
      box.width,
      narrow ? window.innerHeight * NARROW_IMAGE : box.height - STRIP_SPACE,
    )
    frame.style.width = `${size.width}px`
    frame.style.height = `${size.height}px`
  }, [shot])

  useLayoutEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [fit])

  /** Lleva una copia de la imagen de una caja a otra, y avisa al llegar. */
  const fly = useCallback((from: DOMRect, to: DOMRect, src: string, done: () => void) => {
    const ghost = document.createElement('img')
    ghost.className = styles.ghost
    ghost.src = src
    ghost.alt = ''
    const place = (box: DOMRect) => {
      ghost.style.left = `${box.left}px`
      ghost.style.top = `${box.top}px`
      ghost.style.width = `${box.width}px`
      ghost.style.height = `${box.height}px`
    }
    place(from)
    document.body.appendChild(ghost)
    void ghost.offsetWidth
    place(to)
    let finished = false
    const end = () => {
      if (finished) return
      finished = true
      done()
      ghost.remove()
    }
    ghost.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'width') end()
    })
    // Si la transición no llega a dispararse, que no se quede a medias.
    const timer = window.setTimeout(end, FLIGHT_MS + 200)
    return () => {
      window.clearTimeout(timer)
      ghost.remove()
    }
  }, [])

  // Al abrir: la miniatura viaja hasta el marco.
  useEffect(() => {
    const thumb = thumbOf(id)
    const frame = frameRef.current
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const first = work.shots[0]
    if (!thumb || !frame || !first || still) {
      setStage('open')
      return
    }
    const picture = thumb.querySelector('img')
    if (picture) picture.style.visibility = 'hidden'
    const cancel = fly(thumb.getBoundingClientRect(), frame.getBoundingClientRect(), first.src, () => {
      setStage('open')
      if (picture) picture.style.visibility = ''
    })
    return () => {
      cancel()
      if (picture) picture.style.visibility = ''
    }
    // Solo al montar: después se cambia de ficha con un fundido, sin viaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelLeaveRef = useRef<(() => void) | null>(null)
  useEffect(() => () => cancelLeaveRef.current?.(), [])

  /** Al cerrar: la imagen vuelve a la fila de lo que se estaba mirando. */
  const close = useCallback(() => {
    if (stageRef.current !== 'open') return
    const thumb = thumbOf(id)
    const frame = frameRef.current
    const first = work.shots[0]
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!thumb || !frame || !first || still) {
      onClose()
      return
    }
    thumb.scrollIntoView({ block: 'nearest' })
    const picture = thumb.querySelector('img')
    if (picture) picture.style.visibility = 'hidden'
    const from = frame.getBoundingClientRect()
    setStage('leaving')
    const cancel = fly(from, thumb.getBoundingClientRect(), first.src, () => {
      if (picture) picture.style.visibility = ''
      cancelLeaveRef.current = null
      onClose()
    })
    cancelLeaveRef.current = () => {
      cancel()
      if (picture) picture.style.visibility = ''
    }
  }, [fly, id, onClose, thumbOf, work.shots])

  /** Pasa a otra ficha sin cerrar el visor. */
  const go = useCallback(
    (to: string) => {
      if (stageRef.current !== 'open' || to === id) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onChange(to)
        return
      }
      setSwapping(true)
      window.setTimeout(() => {
        onChange(to)
        setSwapping(false)
      }, SWAP_MS)
    },
    [id, onChange],
  )

  useOverlay({
    boxRef,
    focusRef: closeRef,
    onClose: close,
    onKey: (key) => {
      if (where.total <= 1) return false
      if (key === 'ArrowRight') go(sibling(works, id, 1))
      else if (key === 'ArrowLeft') go(sibling(works, id, -1))
      else return false
      return true
    },
  })

  const state = `${stage === 'open' ? styles.settled : ''} ${stage === 'leaving' ? styles.leaving : ''} ${
    swapping ? styles.swap : ''
  }`

  return createPortal(
    <div
      ref={boxRef}
      className={`${styles.viewer} ${state}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-titulo"
    >
      <div className={styles.veil} onClick={close} />

      <div
        className={styles.layout}
        onClick={(event) => {
          if (event.target === event.currentTarget) close()
        }}
      >
        <div
          ref={figureRef}
          className={styles.figure}
          onClick={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <div ref={frameRef} className={styles.frame}>
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={shot.src} src={shot.src} alt={shot.alt} />
            ) : null}
          </div>
          {work.shots.length > 1 ? (
            <div className={styles.strip}>
              {work.shots.map((item, index) => (
                <button
                  key={item.src}
                  type="button"
                  aria-label={`Imagen ${index + 1} de ${work.shots.length}`}
                  aria-current={index === shotIndex ? 'true' : undefined}
                  onClick={() => setSeen({ id, shot: index })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <article className={styles.card} data-overlay-scroll>
          <h2 id="ficha-titulo">{work.title}</h2>
          {/* En un hackatón esa línea repetiría la descripción, que ya es una frase. */}
          {work.group === 'project' ? (
            <p className={styles.lede}>
              {work.what}
              {work.who ? ` · ${work.who}` : ''}
            </p>
          ) : null}
          {work.place ? (
            <p>
              <span className={`${styles.place} ${PLACE_CLASS[work.place]}`}>
                {PLACE_LABEL[work.place]}
              </span>
              {work.group === 'project' && work.event ? ` en ${work.event}` : ''}
            </p>
          ) : work.event ? (
            <p>Hecho en el {work.event}.</p>
          ) : null}
          <p>{work.text}</p>
          {work.tech.length > 0 ? <p className={styles.tech}>{work.tech.join(', ')}</p> : null}
          {work.url || work.repo || work.jump || work.group === 'project' ? (
            <div className={styles.actions}>
              {work.url ? (
                <a className={styles.button} href={work.url} target="_blank" rel="noreferrer noopener">
                  Abrir la demo
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
                  </svg>
                </a>
              ) : work.repo ? (
                <a className={styles.button} href={work.repo} target="_blank" rel="noreferrer noopener">
                  Ver el código
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" />
                  </svg>
                </a>
              ) : work.group === 'project' ? (
                <span className={styles.none}>Sin demo pública</span>
              ) : null}
              {work.jump ? (
                <button
                  type="button"
                  className={`${styles.button} ${styles.quiet}`}
                  onClick={() => go(work.jump!.to)}
                >
                  {work.jump.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      </div>

      <div className={styles.tools}>
        {where.total > 1 ? (
          <>
            <span className={styles.count}>
              {where.index} / {where.total}
            </span>
            <button
              type="button"
              className={styles.tool}
              aria-label="Anterior"
              onClick={() => go(sibling(works, id, -1))}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M12 4l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className={styles.tool}
              aria-label="Siguiente"
              onClick={() => go(sibling(works, id, 1))}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M8 4l6 6-6 6" />
              </svg>
            </button>
          </>
        ) : null}
        <button ref={closeRef} type="button" className={styles.tool} aria-label="Cerrar" onClick={close}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  )
}
