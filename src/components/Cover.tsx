'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ABOUT_PAGES,
  CONTACT,
  EVENTS,
  MADE,
  PROJECTS,
  RECIPES,
} from '@/content/portfolio'

import Lightbox, { type LightboxItem } from './Lightbox'
import { DUO, framePosition, gazeFrame, wantsHalfDuo } from './coverSheet'
import { easeFor, wheelPixels } from './smoothing'
import styles from './Cover.module.css'

/** Lo que tarda la portada en apartarse. La página espera esto para quitarla. */
export const COVER_LEAVE_MS = 760

/** Fracción del ancho de la ventana a la que el avatar ya mira del todo. */
const GAZE_REACH = 0.35
const BLINK_MIN_MS = 2600
const BLINK_SPAN_MS = 2800
/** Cuánto se acerca la hoja a donde la manda la rueda, por frame a 60 Hz. */
const SCROLL_EASE = 0.16

const PLACE_MARK: Record<1 | 2 | 3, string> = { 1: '1.º', 2: '2.º', 3: '3.º' }
const PLACE_CLASS: Record<1 | 2 | 3, string> = { 1: styles.gold, 2: styles.iron, 3: styles.copper }

const podiums = EVENTS.filter((event) => event.place !== null)
const others = EVENTS.filter((event) => event.place === null)
const demos = PROJECTS.filter((project) => project.url).length

const techOf = (grid: (string | null)[]) => grid.filter((cell): cell is string => cell !== null)

interface CoverProps {
  /** Apartándose: la diagonal barre hacia el lado y deja el mundo. */
  leaving: boolean
  /** Llega con un `/tp` desde el mundo: entra barriendo, al revés. */
  arrives: boolean
  onEnter: () => void
}

/**
 * La portada: una hoja por encima del mundo real.
 *
 * La pantalla va partida en diagonal —papel a la izquierda, mundo a la
 * derecha— y lo que se ve por el lado del mundo ES el mundo, montado detrás y
 * quieto. No es una copia: una copia habría que calzarla al píxel con el de
 * verdad justo al entrar, y cualquier desajuste se ve como un salto.
 *
 * Baja dentro de su propia caja. El scroll del documento es la posición del
 * mundo y no se comparte: dos usos del mismo scroll ya dieron problemas en
 * móvil.
 *
 * Los enlaces de dentro no llevan ancla (`#…`) a propósito: `:target` es lo
 * que esconde la portada cuando se llega con el ancla de una sección del
 * mundo, y un ancla propia la escondería a ella misma.
 */
export default function Cover({ leaving, arrives, onEnter }: CoverProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const [duoHalf, setDuoHalf] = useState(true)
  /** Al llegar se monta apartada y se asienta en el frame siguiente: así la
   *  entrada es la misma transición que la salida, vista al revés. */
  const [settled, setSettled] = useState(!arrives)

  useEffect(() => {
    if (settled) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setSettled(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [settled])
  const [viewer, setViewer] = useState<{ items: LightboxItem[]; index: number } | null>(null)
  const viewerOpenRef = useRef(false)
  viewerOpenRef.current = viewer !== null
  /** Corta el suavizado de la rueda cuando otra cosa va a mover la hoja. */
  const stopScrollRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const avatar = avatarRef.current
    if (!avatar) return
    const fit = () =>
      setDuoHalf(wantsHalfDuo(avatar.getBoundingClientRect().height * window.devicePixelRatio))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // La mirada y el parpadeo se escriben al nodo: no son estado de React.
  useEffect(() => {
    const avatar = avatarRef.current
    if (!avatar) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let gaze = Math.floor(DUO.gazes / 2)
    let blinking = false
    const timers: number[] = []
    const show = (frame: number) => {
      avatar.style.backgroundPositionX = framePosition(frame)
    }
    const later = (run: () => void, ms: number) => {
      timers.push(window.setTimeout(run, ms))
    }
    const onMove = (event: PointerEvent) => {
      const box = avatar.getBoundingClientRect()
      gaze = gazeFrame(event.clientX, box.left + box.width / 2, window.innerWidth * GAZE_REACH)
      if (!blinking) show(gaze)
    }
    const blink = () => {
      blinking = true
      show(DUO.halfShut)
      later(() => show(DUO.shut), 60)
      later(() => show(DUO.halfShut), 150)
      later(() => {
        blinking = false
        show(gaze)
      }, 210)
      later(blink, BLINK_MIN_MS + Math.random() * BLINK_SPAN_MS)
    }
    show(gaze)
    window.addEventListener('pointermove', onMove)
    if (!still) later(blink, 1800)
    return () => {
      window.removeEventListener('pointermove', onMove)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  /**
   * La rueda manda un destino y la hoja lo alcanza suavizando, por tiempo
   * (`easeFor`), igual que el mundo sigue al scroll. Con ratón el navegador
   * la movía a saltos de cien píxeles. Sin Lenis: es la misma razón por la
   * que se quitó del mundo.
   *
   * Solo la rueda. El dedo, el teclado y la barra van por el navegador, y
   * cuando mueven la hoja el destino se pone al día con ella.
   */
  useEffect(() => {
    const box = boxRef.current
    if (!box || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let current = box.scrollTop
    let target = current
    let last = 0
    let raf = 0
    let driving = false
    const stop = () => {
      cancelAnimationFrame(raf)
      driving = false
    }
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const gap = target - current
      if (Math.abs(gap) < 0.5) {
        box.scrollTop = target
        driving = false
        return
      }
      current += gap * easeFor(SCROLL_EASE, dt)
      box.scrollTop = current
      raf = requestAnimationFrame(step)
    }
    const onWheel = (event: WheelEvent) => {
      // Con Ctrl es zoom, y con el visor abierto la rueda es suya.
      if (event.ctrlKey || viewerOpenRef.current) return
      event.preventDefault()
      if (!driving) {
        current = box.scrollTop
        target = current
      }
      const most = box.scrollHeight - box.clientHeight
      target = Math.max(
        0,
        Math.min(most, target + wheelPixels(event.deltaY, event.deltaMode, box.clientHeight)),
      )
      if (!driving) {
        driving = true
        last = performance.now()
        raf = requestAnimationFrame(step)
      }
    }
    const onScroll = () => {
      if (driving) return
      current = box.scrollTop
      target = current
    }
    stopScrollRef.current = stop
    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stop()
      stopScrollRef.current = null
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('scroll', onScroll)
    }
  }, [])

  const enter = useCallback(() => {
    // Se entra desde arriba: la diagonal es lo que se aparta, y con la hoja
    // a medio subir no hay diagonal que apartar.
    stopScrollRef.current?.()
    boxRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    onEnter()
  }, [onEnter])

  const toWork = useCallback(() => {
    stopScrollRef.current?.()
    sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Un proyecto puede no tener captura: se queda en texto y no entra al visor.
  const projectShots: (LightboxItem & { id: string })[] = PROJECTS.flatMap((project) =>
    project.shot
      ? [{ id: project.id, src: project.shot, alt: `Captura de ${project.name}`, caption: project.name }]
      : [],
  )

  return (
    <div
      ref={boxRef}
      className={`${styles.cover} ${leaving || !settled ? styles.leaving : ''}`}
      inert={leaving}
    >
      <header className={styles.hero}>
        <div className={styles.paper} />
        <h1 className={`${styles.name} ${styles.ink}`}>Vicente Araya</h1>
        <span className={`${styles.name} ${styles.snow}`} aria-hidden="true">
          Vicente Araya
        </span>

        <div className={styles.under}>
          <span className={styles.role}>Desarrollador full-stack</span>
          <p className={styles.pitch}>Construyo software que resuelve problemas concretos.</p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.fill}`} onClick={toWork}>
              Ver mi trabajo ↓
            </button>
            <a className={styles.button} href="/cv-vicente-araya.pdf" download>
              CV
            </a>
          </div>
        </div>

        <dl className={styles.tally}>
          <div>
            <dt>podios</dt>
            <dd>{podiums.length}</dd>
          </div>
          <div>
            <dt>proyectos</dt>
            <dd>{PROJECTS.length}</dd>
          </div>
          <div>
            <dt>demos</dt>
            <dd>{demos}</dd>
          </div>
        </dl>

        <div className={styles.pair}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.me}
            src="/vicente.webp"
            width={877}
            height={1100}
            alt="Vicente Araya, de brazos cruzados, sonriendo"
          />
          <div
            ref={avatarRef}
            data-cover-avatar
            className={styles.avatar}
            style={{ backgroundImage: `url(${duoHalf ? DUO.halfSrc : DUO.src})` }}
            role="img"
            aria-label="Su avatar de bloques, con el mismo polerón y la misma postura"
          />
        </div>

        <button type="button" className={`${styles.button} ${styles.fill} ${styles.enter}`} onClick={enter}>
          Recorrer el mundo ▶
        </button>
      </header>

      <div ref={sheetRef} className={styles.sheet}>
        <section className={styles.section} aria-labelledby="portada-hackatones">
          <div className={styles.head}>
            <span className={styles.label}>Hackatones</span>
            <h2 id="portada-hackatones">Tres podios en hackatones.</h2>
          </div>
          <ol className={styles.podium}>
            {podiums.map((event) => {
              const photos = event.photos ?? []
              const cover = photos[0]
              return (
                <li key={event.id} className={styles.place}>
                  {cover ? (
                    <button
                      type="button"
                      className={styles.shot}
                      onClick={() =>
                        setViewer({
                          items: photos.map((photo) => ({
                            ...photo,
                            caption: `${event.name} ${event.year}`,
                          })),
                          index: 0,
                        })
                      }
                      aria-label={`Ver las ${photos.length} fotos de ${event.name} ${event.year}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cover.src} alt={cover.alt} loading="lazy" />
                    </button>
                  ) : null}
                  <p className={`${styles.rank} ${event.place ? PLACE_CLASS[event.place] : ''}`}>
                    <b>{event.place ? PLACE_MARK[event.place] : ''}</b>
                    <span>
                      {event.name} · {event.year}
                    </span>
                  </p>
                  <p className={styles.muted}>{event.summary}</p>
                </li>
              )
            })}
          </ol>
          {others.map((event) => (
            <p key={event.id} className={styles.also}>
              <b>También:</b> {event.name} {event.year}. {event.summary}
            </p>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="portada-proyectos">
          <div className={styles.head}>
            <span className={styles.label}>Proyectos</span>
            <h2 id="portada-proyectos">Para clientes reales y productos propios.</h2>
          </div>
          <ol className={styles.projects}>
            {PROJECTS.map((project) => (
              <li key={project.id} className={styles.project}>
                {project.shot ? (
                  <button
                    type="button"
                    className={styles.shot}
                    onClick={() =>
                      setViewer({
                        items: projectShots,
                        index: projectShots.findIndex((shot) => shot.id === project.id),
                      })
                    }
                    aria-label={`Ver en grande la captura de ${project.name}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={project.shot} alt={`Captura de ${project.name}`} loading="lazy" />
                  </button>
                ) : null}
                <h3>{project.name}</h3>
                <p className={styles.summary}>{project.summary}</p>
                <p className={styles.muted}>{project.description}</p>
                <ul className={styles.tags}>
                  {project.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
                {project.url ? (
                  <a
                    className={styles.go}
                    href={project.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Abrir proyecto ↗
                  </a>
                ) : (
                  <span className={`${styles.go} ${styles.off}`}>Sin demo pública</span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.made}`} aria-labelledby="portada-hecho">
          <div className={styles.head}>
            <span className={styles.label}>Cómo está hecho</span>
            <h2 id="portada-hecho">El mundo también es ingeniería.</h2>
            <p className={styles.muted}>
              El mundo que hay detrás de esta página lo construí entero: el motor de capas, las
              animaciones y la skin. Tres decisiones de ese proyecto.
            </p>
            <button type="button" className={styles.button} onClick={enter}>
              Recorrer el mundo ▶
            </button>
          </div>
          <ul className={styles.facts}>
            {MADE.map((item) => (
              <li key={item.id}>
                <b>{item.figure}</b>
                <h3>{item.title}</h3>
                <p className={styles.muted}>{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} aria-labelledby="portada-sobre-mi">
          <div className={styles.head}>
            <span className={styles.label}>Sobre mí</span>
            <h2 id="portada-sobre-mi">Del problema a algo que funciona de verdad.</h2>
          </div>
          <div className={styles.prose}>
            {ABOUT_PAGES.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="portada-stack">
          <div className={styles.head}>
            <span className={styles.label}>Con qué trabajo</span>
            <h2 id="portada-stack">Lo que he usado en esos proyectos.</h2>
          </div>
          <dl className={styles.stack}>
            {RECIPES.map((recipe) => (
              <div key={recipe.id}>
                <dt>{recipe.result}</dt>
                <dd>{techOf(recipe.grid).join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={`${styles.section} ${styles.contact}`} aria-labelledby="portada-contacto">
          <h2 id="portada-contacto">Hablemos.</h2>
          <ul className={styles.actions}>
            {CONTACT.map((item, index) => (
              <li key={item.id}>
                <a
                  className={`${styles.button} ${index === 0 ? styles.fill : ''}`}
                  href={item.href}
                  {...('download' in item
                    ? { download: true }
                    : { target: '_blank', rel: 'noreferrer noopener' })}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {viewer ? (
        <Lightbox
          items={viewer.items}
          index={viewer.index}
          onIndex={(index) => setViewer({ items: viewer.items, index })}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  )
}
