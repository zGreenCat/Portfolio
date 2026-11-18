'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CONTACT,
  COVER_ABOUT,
  EDUCATION,
  EXPERIENCE,
  PLACE_LABEL,
  PROJECTS,
  RECIPES,
} from '@/content/portfolio'

import WorkViewer from './WorkViewer'
import { OTHER_EVENTS, PODIUM_WORKS, PROJECT_WORKS, WORKS, byYear } from './works'
import { DUO, framePosition, gazeFrame, knobSpot, wantsHalfDuo } from './coverSheet'
import { easeFor, wheelPixels } from './smoothing'
import type { Theme } from '@/world/daylight'
import styles from './Cover.module.css'

/** Lo que tarda la portada en apartarse. La página espera esto para quitarla. */
export const COVER_LEAVE_MS = 760

/** Fracción del ancho de la ventana a la que el avatar ya mira del todo. */
const GAZE_REACH = 0.35
const BLINK_MIN_MS = 2600
const BLINK_SPAN_MS = 2800
/** Cuánto se acerca la hoja a donde la manda la rueda, por frame a 60 Hz. */
const SCROLL_EASE = 0.16

const PLACE_CLASS: Record<1 | 2 | 3, string> = { 1: styles.gold, 2: styles.iron, 3: styles.copper }
const STEP_CLASS: Record<1 | 2 | 3, string> = { 1: styles.first, 2: styles.second, 3: styles.third }

const demos = PROJECTS.filter((project) => project.url).length
const YEARS = byYear(EXPERIENCE)

const techOf = (grid: (string | null)[]) => grid.filter((cell): cell is string => cell !== null)

interface CoverProps {
  /** Apartándose: la diagonal barre hacia el lado y deja el mundo. */
  leaving: boolean
  /** Llega con un `/tp` desde el mundo: entra barriendo, al revés. */
  arrives: boolean
  onEnter: () => void
  theme: Theme
  onTheme: () => void
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
export default function Cover({ leaving, arrives, onEnter, theme, onTheme }: CoverProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLHeadingElement>(null)
  const pairRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLButtonElement>(null)
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
  /** La ficha abierta en el visor, o ninguna. */
  const [openId, setOpenId] = useState<string | null>(null)
  const viewerOpenRef = useRef(false)
  viewerOpenRef.current = openId !== null
  const closeViewer = useCallback(() => setOpenId(null), [])
  /** El nodo de la lista del que sale, y al que vuelve, la imagen de una ficha. */
  const thumbOf = useCallback(
    (id: string) =>
      boxRef.current?.querySelector<HTMLElement>(`[data-work-thumb="${CSS.escape(id)}"]`) ?? null,
    [],
  )
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

  // El tirador va sobre la costura, en mitad del hueco entre el nombre y sus
  // cabezas. Ese hueco depende de la forma de la ventana —el nombre crece con
  // el ancho y ellos con el alto—, así que se mide. En vertical la diagonal
  // está tumbada y su sitio lo pone el CSS.
  useEffect(() => {
    const place = () => {
      const knob = knobRef.current
      const name = nameRef.current
      const pair = pairRef.current
      const hero = knob?.parentElement
      if (!knob || !name || !pair || !hero) return
      if (window.innerWidth <= 760) {
        knob.style.removeProperty('--knob-x')
        knob.style.removeProperty('--knob-y')
        return
      }
      const frame = hero.getBoundingClientRect()
      // Quien llega con el ancla de una sección tiene la portada escondida
      // por CSS (`:has(:target)`) hasta que la página la desmonta: en ese
      // instante no mide nada, y no hay tirador que colocar.
      if (frame.width === 0 || frame.height === 0) return
      // La caja del nombre ocupa toda la pantalla: lo que mide es su texto.
      const range = document.createRange()
      range.selectNodeContents(name)
      const spot = knobSpot(
        range.getBoundingClientRect().bottom - frame.top,
        pair.getBoundingClientRect().top - frame.top,
        frame.width,
        frame.height,
      )
      knob.style.setProperty('--knob-x', `${spot.x}px`)
      knob.style.setProperty('--knob-y', `${spot.y}px`)
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
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

  return (
    <div
      ref={boxRef}
      className={`${styles.cover} ${leaving || !settled ? styles.leaving : ''}`}
      inert={leaving}
    >
      <header className={styles.hero}>
        <div className={styles.paper} />
        <h1 ref={nameRef} className={`${styles.name} ${styles.ink}`}>
          Vicente Araya
        </h1>
        <span className={`${styles.name} ${styles.snow}`} aria-hidden="true">
          Vicente Araya
        </span>

        <div className={styles.under}>
          <span className={styles.role}>Desarrollador full-stack</span>
          <p className={styles.pitch}>{COVER_ABOUT.degree}</p>
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
            <dd>{PODIUM_WORKS.length}</dd>
          </div>
          <div>
            <dt>proyectos</dt>
            <dd>{PROJECT_WORKS.length}</dd>
          </div>
          <div>
            <dt>demos</dt>
            <dd>{demos}</dd>
          </div>
        </dl>

        <div ref={pairRef} className={styles.pair}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.me}
            src="/vicente.webp"
            width={877}
            height={1100}
            fetchPriority="high"
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

        <button
          type="button"
          className={styles.theme}
          onClick={onTheme}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Pasar a tema claro' : 'Pasar a tema oscuro'}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {theme === 'dark' ? (
              <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4M13.2 10a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0z" />
            ) : (
              <path d="M16.2 12.1A6.6 6.6 0 0 1 7.9 3.8a6.6 6.6 0 1 0 8.3 8.3z" />
            )}
          </svg>
        </button>

        {/* El tirador: una pastilla sobre la costura. Su sitio dice lo que
            hace —mueve esta línea— y por eso no es un botón en una esquina. */}
        <button ref={knobRef} type="button" className={styles.enter} onClick={enter}>
          <span className={styles.enterIcon}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </span>
          Recorrer el mundo
        </button>
      </header>

      <div ref={sheetRef} className={styles.sheet}>
        {/* Quién es, antes del trabajo: el puente entre el arranque y los
            proyectos. Sin título; el texto grande se basta. */}
        <section className={`${styles.section} ${styles.intro}`} aria-label="Presentación">
          {COVER_ABOUT.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </section>

        {/* La trayectoria, como en un CV: una línea fina, el año en grande y
            debajo lo que empezó ese año. El círculo relleno es donde está hoy. */}
        <section className={styles.section} aria-labelledby="portada-experiencia">
          <h2 id="portada-experiencia" className={styles.big}>
            Experiencia
          </h2>
          <ol className={styles.timeline}>
            {YEARS.map((group) => (
              <li
                key={group.year}
                className={group.jobs.some((job) => job.current) ? styles.yearNow : undefined}
              >
                <span className={styles.year}>{group.year}</span>
                <ol className={styles.jobs}>
                  {group.jobs.map((job) => (
                    <li key={job.id}>
                      <span className={job.current ? styles.whenNow : styles.when}>{job.when}</span>
                      <h3>{job.role}</h3>
                      <span className={styles.muted}>{job.place}</span>
                      <p>{job.text}</p>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className={styles.also}>
            <b>Formación:</b> {EDUCATION}
          </p>
        </section>

        <section className={styles.section} aria-labelledby="portada-proyectos">
          <h2 id="portada-proyectos" className={styles.big}>
            Proyectos
          </h2>
          {/* Cada fila es un botón entero: abre la ficha. La descripción va
              completa en la página aunque se vea una línea; es lo que leen
              buscadores y lectores de pantalla. */}
          <ol className={styles.index}>
            {PROJECT_WORKS.map((work) => (
              <li key={work.id}>
                <button type="button" className={styles.row} onClick={() => setOpenId(work.id)}>
                  <span className={styles.thumb} data-work-thumb={work.id}>
                    {work.shots[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={work.shots[0].src} alt="" loading="lazy" />
                    ) : null}
                  </span>
                  <span className={styles.rowName}>
                    <span className={styles.rowTitle}>{work.title}</span>
                    <span className={styles.gist}>{work.text}</span>
                  </span>
                  <span className={styles.meta}>
                    <b>{work.what}</b>
                    <span>
                      {work.place ? (
                        <>
                          <span className={`${styles.placeInline} ${PLACE_CLASS[work.place]}`}>
                            {PLACE_LABEL[work.place]}
                          </span>
                          {work.event ? `, ${work.event}` : ''}
                        </>
                      ) : work.event ? (
                        `Hecho en el ${work.event}`
                      ) : (
                        work.who
                      )}
                    </span>
                  </span>
                  <svg className={styles.arrow} viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 10h12M11 5l5 5-5 5" />
                  </svg>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="portada-hackatones">
          <h2 id="portada-hackatones" className={styles.big}>
            Tres podios en hackatones
          </h2>
          {/* Tres alturas, el primero al centro. El orden lo da `podiumOrder`. */}
          <ol className={styles.podium}>
            {PODIUM_WORKS.map((work) =>
              work.place ? (
                <li key={work.id} className={STEP_CLASS[work.place]}>
                  <button
                    type="button"
                    className={`${styles.step} ${PLACE_CLASS[work.place]}`}
                    onClick={() => setOpenId(work.id)}
                  >
                    <span className={styles.thumb} data-work-thumb={work.id}>
                      {work.shots[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={work.shots[0].src} alt={work.shots[0].alt} loading="lazy" />
                      ) : null}
                    </span>
                    <span className={styles.base}>
                      <span className={styles.placeBig}>{PLACE_LABEL[work.place]}</span>
                      <span className={styles.rowTitle}>{work.title}</span>
                      <span className={styles.gistOpen}>{work.text}</span>
                    </span>
                  </button>
                </li>
              ) : null,
            )}
          </ol>
          {OTHER_EVENTS.map((event) => (
            <p key={event.label} className={styles.also}>
              También participé en el {event.label}.{' '}
              {event.projectWork ? (
                <button
                  type="button"
                  className={styles.textLink}
                  onClick={() => setOpenId(event.projectWork)}
                >
                  Ver el proyecto que salió de ahí
                </button>
              ) : null}
            </p>
          ))}
        </section>

        <section className={styles.section} aria-labelledby="portada-stack">
          <div className={styles.head}>
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

        <section className={styles.section} aria-labelledby="portada-sobre-mi">
          <div className={styles.head}>
            <h2 id="portada-sobre-mi">Del problema a algo que funciona de verdad.</h2>
          </div>
          <div className={styles.prose}>
            {COVER_ABOUT.rest.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
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

      {openId ? (
        <WorkViewer
          works={WORKS}
          id={openId}
          onChange={setOpenId}
          onClose={closeViewer}
          thumbOf={thumbOf}
        />
      ) : null}
    </div>
  )
}
