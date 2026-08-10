'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import Character, {
  FRAME_COUNT,
  SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from '@/components/Character'
import EnderPearl, { type PearlThrow } from '@/components/EnderPearl'
import Book from '@/components/Book'
import CraftingTable from '@/components/CraftingTable'
import Inventory from '@/components/Inventory'
import NightSky from '@/components/NightSky'
import Signs from '@/components/Signs'
import { isMuted, play, setMuted } from '@/lib/sounds'
import { ABOUT_PAGES, PROJECTS } from '@/content/portfolio'
import Strip from '@/components/ParallaxLayer'
import layerStyles from '@/components/ParallaxLayer.module.css'
import SpriteGrid from '@/components/SpriteGrid'

import styles from './recorrido.module.css'

type Phase = 'loading' | 'greeting' | 'entering' | 'ready'

const PRELOAD = [
  '/sprites/peek_wave.webp',
  '/sprites/run.webp',
  '/sprites/idle.webp',
  '/layers/b1_ground.webp',
  '/layers/b1_near.webp',
  '/layers/b1_mid.webp',
  '/layers/b1_far.webp',
]

const BAR_CELLS = 14
const MIN_LOADING_MS = 500
const MAX_LOADING_MS = 1500

/** Sin los 5 frames vacíos del original: cuatro al inicio y uno al final, que
 *  eran 0,4 s de nada. Y a 18 fps en vez de 12: los 12 venían de cuando el
 *  saludo iba gobernado por scroll, pero se reproduce solo y se veía a tirones. */
const PEEK = { cellWidth: 435, cellHeight: 600, columns: 8, rows: 4, frames: 32, fps: 18 }

/** Alto de página dedicado al recorrido. */
const SCROLL_LENGTH = 7000
/** Píxeles de mundo que recorre la capa del suelo de punta a punta. */
const WORLD_LENGTH = 12000
const LAYER_ASPECT = 3840 / 1440
const LAYER_HEIGHT_SOURCE = 1440
const BLOCK_PX_SOURCE = 143
/** Bloques que avanza cada ciclo. Caminar cubre menos suelo por zancada, así
 *  que su ciclo tiene que ir más apretado o los pies patinan. */
const STRIDE: Record<CharacterState, number> = { run: 2.1, walk: 1.25, idle: 1, throw: 1 }
/** Umbrales de velocidad, en px de mundo por frame. Por debajo del de caminar
 *  se considera parado. */
const SPEED_RUN = 13
const SPEED_WALK = 1.6
/** Frames seguidos por debajo del umbral antes de pasar a reposo. A 60 Hz son
 *  ~130 ms: evita que parpadee entre marchas sin que se note el retardo. */
const IDLE_FRAMES = 8
/** Duración del lanzamiento completo. */
const THROW_MS = 700
/** Dónde empieza a caer la tarde y dónde es noche cerrada, en progreso de
 *  mundo. El anochecer se reparte por el último tercio para que se perciba
 *  como un viaje largo, no como un cambio de bioma. */
const DUSK_FROM = 0.62
const NIGHT_AT = 0.94
const CHAR_HEIGHT_VH = 0.1986
const PEEK_CELL_VH = 0.78
const PEEK_CELL_PX = 600

const ENTRY_FROM = -28
/** Posición del personaje en pantalla, en %. Es también su centro visual:
 *  Character se desplaza -centerX, así que `left` cae en su eje. */
const ENTRY_TO = 20
/** Fila del render donde caen los pies en b1. De ahí sale --char-feet: los
 *  pies van 26 px por debajo de la superficie, dentro de la banda de hierba. */
const FEET_BELOW_SURFACE = 26
const CHAR_FEET_VH = (LAYER_HEIGHT_SOURCE - (1278 + FEET_BELOW_SURFACE)) / LAYER_HEIGHT_SOURCE
/** Entra caminando, no corriendo: viene de saludar, no de una carrera.
 *  Más lento que antes porque a paso de caminata 1,4 s se leía como prisa. */
const ENTRY_SECONDS = 2.2

const LAYER_SPEED = { far: 0.15, mid: 0.3, near: 0.55, ground: 1 } as const

const ALL_KINDS = ['far', 'mid', 'near', 'ground'] as const
const END_KINDS = ['far', 'ground'] as const
type Kind = (typeof ALL_KINDS)[number]

/** Las secciones son lugares del mundo, no pantallas: `at` es su posición.
 *  Cada una tiene su bioma; el prefijo nombra los cuatro archivos de capa. */
/** `surfaceY` es la fila del render donde está la superficie que se pisa.
 *  No es la misma en todos: la taiga lleva capa de nieve encima de la hierba y
 *  su suelo queda 17 px más alto. En vez de pedir que lo igualen —que sería
 *  quitarle la nieve— el personaje sube con el terreno. */
const SECTIONS = [
  { id: 'inicio', label: 'Inicio', at: 0, biome: 'b1', surfaceY: 1278, kinds: ALL_KINDS },
  { id: 'sobre-mi', label: 'Sobre mí', at: 0.24, biome: 'b2', surfaceY: 1267, kinds: ALL_KINDS },
  // El templo del desierto no se tesela: es un edificio, y los edificios no
  // se repiten cada 300 metros. Va anclado a la sección.
  {
    id: 'proyectos',
    label: 'Proyectos',
    at: 0.52,
    biome: 'b3',
    surfaceY: 1278,
    kinds: ALL_KINDS,
    anchored: ['far'] as readonly string[],
  },
  { id: 'skills', label: 'Skills', at: 0.74, biome: 'b4', surfaceY: 1278, kinds: ALL_KINDS },
  // El acantilado es el final del mundo: una sola copia anclada, sin repetir,
  // y sin capas intermedias porque ahí ya no hay recorrido que acompañar.
  { id: 'contacto', label: 'Contacto', at: 0.96, biome: 'b5', surfaceY: 1241, kinds: END_KINDS },
] as const

/** Fracción de la tesela donde se acaba el suelo del acantilado. */
const CLIFF_EDGE = 2533 / 3840
/** En el acantilado el personaje se desplaza hacia el centro. El árbol queda
 *  772 px a la izquierda del borde del vacío, y con él al 20% se salía de
 *  cuadro. Además, encuadrar más abierto sienta mejor a un final. */
const CLIFF_X = 48
const CLIFF_FROM = 0.84

/** Ancho del fundido entre biomas, en unidades de progreso. */
const BLEND = 0.09
/** Fuera de este radio el bioma se desmonta: cuatro capas de 3840×1440 son
 *  ~88 MB de memoria descomprimida, y cinco biomas a la vez matan un móvil. */
const MOUNT_RADIUS = 0.34

/** Distancias de apertura de los paneles, en unidades de progreso del mundo.
 *  Se cierran más lejos de lo que se abren: sin esa histéresis, un roce de
 *  rueda mientras lees el panel lo haría parpadear. */
const PANEL_OPEN_AT = 0.035
const PANEL_CLOSE_AT = 0.075

/** Cuánto está abierto el panel de una sección según lo cerca que estés. */
function panelOpenness(at: number, world: number): number {
  const d = Math.abs(at - world)
  return Math.min(1, Math.max(0, 1 - (d - PANEL_OPEN_AT) / (PANEL_CLOSE_AT - PANEL_OPEN_AT)))
}

const SPLASHES = [
  '¡Hecho con bloques!',
  'Sin plantillas',
  'Renderizado a mano',
  '¡Prueba la perla!',
  'Ahora con parallax',
  'Se acepta feedback',
]

/**
 * Peso de un bioma según lo cerca que estés. Los biomas no ocupan un tramo
 * cada uno: los cinco cubren el mundo entero y se funden por opacidad. Así no
 * hay que empalmar terrenos, que es lo caro de producir.
 */
function biomeOpacity(at: number, world: number): number {
  const d = Math.abs(at - world)
  if (d <= BLEND * 0.5) return 1
  return Math.max(0, 1 - (d - BLEND * 0.5) / BLEND)
}

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
  })
}

export default function RecorridoPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [characterState, setCharacterState] = useState<CharacterState>('idle')
  const [charHeight, setCharHeight] = useState(200)
  const [peekScale, setPeekScale] = useState(1)
  const [runFrame, setRunFrame] = useState(0)
  const [started, setStarted] = useState(false)
  const [splash, setSplash] = useState(SPLASHES[0])
  const [active, setActive] = useState<string>('inicio')
  const [shot, setShot] = useState<PearlThrow | null>(null)
  const [hidden, setHidden] = useState(false)
  const [pageHeight, setPageHeight] = useState(SCROLL_LENGTH)
  const [chestOpen, setChestOpen] = useState(0)
  const [bookOpen, setBookOpen] = useState(0)
  const [signsOpen, setSignsOpen] = useState(0)
  const [benchOpen, setBenchOpen] = useState(0)
  const [muted, setMutedState] = useState(false)
  const [worldAt, setWorldAt] = useState(0)
  const [night, setNight] = useState(0)
  const [actorX, setActorX] = useState(ENTRY_TO)
  const [feetVh, setFeetVh] = useState(CHAR_FEET_VH)

  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef<HTMLDivElement>(null)
  const groundRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<HTMLDivElement>(null)
  const actorRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<CharacterState>('idle')
  const teleportingRef = useRef(false)

  useEffect(() => setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]), [])
  useEffect(() => setMutedState(isMuted()), [])

  // --- gesto de lanzamiento ---
  useEffect(() => {
    if (characterState !== 'throw') return
    const t0 = performance.now()
    let raf = 0
    let released = false
    const step = (now: number) => {
      const t = (now - t0) / THROW_MS
      if (!released && t >= THROW_RELEASE.frame / FRAME_COUNT.throw) {
        released = true
        play('throw')
      }
      if (t >= 1) {
        // Al acabar el gesto vuelve a reposo. Sin esto se quedaba clavado en
        // el último frame del lanzamiento mientras la perla seguía volando.
        stateRef.current = 'idle'
        setCharacterState('idle')
        return
      }
      setRunFrame(Math.floor(t * FRAME_COUNT.throw))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [characterState])

  // --- carga ---
  useEffect(() => {
    let cancelled = false
    const t0 = performance.now()
    let done = 0

    const enter = () => {
      if (cancelled) return
      window.setTimeout(
        () => {
          if (!cancelled) setPhase('greeting')
        },
        Math.max(0, MIN_LOADING_MS - (performance.now() - t0)),
      )
    }

    PRELOAD.forEach((src) => {
      void preload(src).then(() => {
        done += 1
        if (!cancelled) setProgress(done / PRELOAD.length)
        if (done === PRELOAD.length) enter()
      })
    })

    const cap = window.setTimeout(() => {
      if (!cancelled) setPhase('greeting')
    }, MAX_LOADING_MS)

    return () => {
      cancelled = true
      window.clearTimeout(cap)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = phase === 'ready' ? '' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [phase])

  useEffect(() => {
    const fit = () => {
      setCharHeight(window.innerHeight * CHAR_HEIGHT_VH)
      setPeekScale((window.innerHeight * PEEK_CELL_VH) / PEEK_CELL_PX)
      setPageHeight(SCROLL_LENGTH + window.innerHeight)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // --- entrada al mundo ---
  useEffect(() => {
    if (phase !== 'entering') return
    const actor = actorRef.current
    if (!actor) return

    stateRef.current = 'walk'
    setCharacterState('walk')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      actor.style.left = `${ENTRY_TO}%`
      setPhase('ready')
      return
    }

    const distance = ((ENTRY_TO - ENTRY_FROM) / 100) * window.innerWidth
    const stride = BLOCK_PX_SOURCE * (window.innerHeight / LAYER_HEIGHT_SOURCE) * STRIDE.walk
    const t0 = performance.now()
    let raf = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / (ENTRY_SECONDS * 1000))
      const eased = 1 - (1 - t) ** 3
      actor.style.left = `${ENTRY_FROM + (ENTRY_TO - ENTRY_FROM) * eased}%`
      setRunFrame(Math.floor(((eased * distance) / stride) * FRAME_COUNT.walk))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        stateRef.current = 'idle'
        setCharacterState('idle')
        setPhase('ready')
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // --- recorrido: el scroll es una posición del mundo, no una línea de tiempo ---
  useEffect(() => {
    if (phase !== 'ready') return

    let raf = 0
    let current = 0
    let target = 0
    let stillFor = 0

    const applyState = (next: CharacterState) => {
      if (stateRef.current === next) return
      stateRef.current = next
      setCharacterState(next)
    }

    const read = () => {
      target = Math.min(1, Math.max(0, window.scrollY / SCROLL_LENGTH))
    }

    const block = BLOCK_PX_SOURCE * (window.innerHeight / LAYER_HEIGHT_SOURCE)
    let previous = 0

    const frame = () => {
      // Suavizado: sin esto el mundo salta con cada muesca de la rueda.
      current += (target - current) * 0.12
      if (Math.abs(target - current) < 0.00002) current = target

      const worldX = current * WORLD_LENGTH
      const nodes: [HTMLDivElement | null, number][] = [
        [farRef.current, LAYER_SPEED.far],
        [midRef.current, LAYER_SPEED.mid],
        [nearRef.current, LAYER_SPEED.near],
        [groundRef.current, LAYER_SPEED.ground],
        [markersRef.current, LAYER_SPEED.ground],
      ]
      nodes.forEach(([node, speed]) => {
        if (node) node.style.transform = `translate3d(${-worldX * speed}px,0,0)`
      })

      // Tres marchas por velocidad de avance: correr, caminar, parado.
      const speed = Math.abs(worldX - previous)
      previous = worldX
      if (speed <= SPEED_WALK) stillFor += 1
      else stillFor = 0

      if (!teleportingRef.current) {
        // El retardo se cuenta en frames, no con un temporizador: dentro del
        // bucle, un setTimeout se reiniciaba en cada vuelta y no llegaba a
        // cumplirse nunca, así que se quedaba caminando para siempre.
        if (stillFor >= IDLE_FRAMES) applyState('idle')
        else if (speed > SPEED_RUN) applyState('run')
        else if (speed > SPEED_WALK) applyState('walk')
      }

      // La zancada sale del suelo recorrido, y cada marcha cubre lo suyo.
      // `stride` son los píxeles que avanza un ciclo completo, así que
      // worldX/stride son ciclos y ×count da el frame. Character envuelve.
      const active = stateRef.current
      const stride = block * STRIDE[active]
      setRunFrame(Math.floor((worldX / stride) * FRAME_COUNT[active]))
      setStarted(current > 0.004)
      setWorldAt(current)
      setNight(Math.min(1, Math.max(0, (current - DUSK_FROM) / (NIGHT_AT - DUSK_FROM))))

      // Se abre el encuadre al acercarse al acantilado.
      const toCliff = Math.min(1, Math.max(0, (current - CLIFF_FROM) / (1 - CLIFF_FROM)))
      setActorX(ENTRY_TO + (CLIFF_X - ENTRY_TO) * toCliff)

      // El suelo del personaje sigue al bioma: media de las superficies
      // ponderada por su opacidad, así al cruzar el fundido sube o baja con él.
      let wsum = 0
      let acc = 0
      SECTIONS.forEach((sec) => {
        const w = biomeOpacity(sec.at, current)
        if (w <= 0) return
        wsum += w
        acc += w * ((LAYER_HEIGHT_SOURCE - (sec.surfaceY + FEET_BELOW_SURFACE)) / LAYER_HEIGHT_SOURCE)
      })
      if (wsum > 0) setFeetVh(acc / wsum)

      // Apertura por distancia: es una función de la posición, no un
      // disparador. Así no hay estado que sincronizar ni re-disparos al volver.
      setChestOpen(panelOpenness(SECTIONS[2].at, current))
      setBookOpen(panelOpenness(SECTIONS[1].at, current))
      setSignsOpen(panelOpenness(SECTIONS[4].at, current))
      setBenchOpen(panelOpenness(SECTIONS[3].at, current))
      setActive(
        SECTIONS.reduce((best, s) =>
          Math.abs(s.at - current) < Math.abs(best.at - current) ? s : best,
        ).id,
      )

      raf = requestAnimationFrame(frame)
    }

    const onScroll = read

    read()
    current = target
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [phase])

  const jumpTo = useCallback((at: number, id: string) => {
    window.scrollTo({ top: at * SCROLL_LENGTH, behavior: 'auto' })
    window.history.replaceState(null, '', `#${id}`)
    setActive(id)
  }, [])

  const navigate = useCallback(
    (section: (typeof SECTIONS)[number]) => {
      // Segundo clic durante el vuelo: al destino y punto. Nadie espera dos veces.
      if (teleportingRef.current) {
        setShot(null)
        teleportingRef.current = false
        setHidden(false)
        jumpTo(section.at, section.id)
        return
      }
      play('button')
      teleportingRef.current = true
      stateRef.current = 'throw'
      setCharacterState('throw')

      // La perla sale de la mano en el frame de máxima extensión, no del
      // centro del personaje: la geometría de la hoja dice dónde está.
      const sheet = SHEET_GEOMETRY.throw
      const scale = charHeight / sheet.charHeight
      const cellBottom = feetVh * window.innerHeight - (600 - sheet.footY) * scale
      const cellTopY = window.innerHeight - cellBottom - 600 * scale
      const handX =
        window.innerWidth * (actorX / 100) + (THROW_RELEASE.handX - sheet.centerX) * scale
      const handY = cellTopY + THROW_RELEASE.handY * scale

      setShot({
        fromX: handX,
        fromY: handY,
        // Aterriza exactamente donde el personaje se planta: mismo eje, mismos pies.
        toX: window.innerWidth * (actorX / 100),
        toY: window.innerHeight * (1 - feetVh),
        onCross: () => {
          // Se desvanece al salir la perla de plano, no al lanzarla: si no,
          // se queda un hueco vacío en la pantalla de origen.
          setHidden(true)
          jumpTo(section.at, section.id)
        },
        // La perla espera a que la mano llegue al frame de suelta.
        delayMs: (THROW_RELEASE.frame / FRAME_COUNT.throw) * THROW_MS,
        // Reaparece en el impacto, con el estallido.
        onLand: () => {
          play('teleport')
          setHidden(false)
          stateRef.current = 'idle'
          setCharacterState('idle')
        },
        onEnd: () => {
          teleportingRef.current = false
          setShot(null)
        },
      })
    },
    [jumpTo, feetVh, charHeight, actorX],
  )

  const handleGreetingEnd = useCallback(() => setPhase('entering'), [])

  const filled = Math.round(progress * BAR_CELLS)
  const titleClass = started ? styles.titlesOut : phase === 'ready' ? styles.titlesIn : ''
  const tileWidth = charHeight / CHAR_HEIGHT_VH ? (charHeight / CHAR_HEIGHT_VH) * LAYER_ASPECT : 2880
  /** Centra una tesela en la pantalla justo al llegar a su sección. Lo usan
   *  los elementos que son un LUGAR y no una textura repetible. */
  const centredAnchor = (at: number, speed: number, width: number) =>
    at * WORLD_LENGTH * speed +
    (typeof window === 'undefined' ? 0 : window.innerWidth / 2) -
    width / 2

  /** Coloca la tesela del acantilado para que el borde del vacío caiga justo
   *  donde se planta el personaje cuando el mundo llega a su fin. */
  const cliffAnchor =
    WORLD_LENGTH + (typeof window === 'undefined' ? 0 : window.innerWidth * (CLIFF_X / 100)) -
    CLIFF_EDGE * tileWidth

  return (
    <main
      className={styles.page}
      style={
        {
          height: pageHeight,
          '--char-feet': `${feetVh * 100}vh`,
          // El terreno se apaga y se enfría con la noche. Así el mismo render
          // sirve para cualquier hora sin volver a pasarlo por Mine-imator.
          '--world-grade': `brightness(${1.1 - night * 0.62}) contrast(${1.08 - night * 0.1}) saturate(${1.06 - night * 0.5}) hue-rotate(${night * 12}deg)`,
        } as React.CSSProperties
      }
    >
      <div className={styles.stage}>
        <NightSky night={night} />

        {(['far', 'mid', 'near'] as Kind[]).map((kind) => (
          <div
            key={kind}
            ref={kind === 'far' ? farRef : kind === 'mid' ? midRef : nearRef}
            className={`${layerStyles.box} ${styles[kind]}`}
          >
            {SECTIONS.filter(
              (s) =>
                Math.abs(s.at - worldAt) < MOUNT_RADIUS &&
                (s.kinds as readonly string[]).includes(kind),
            ).map((s) => (
              <Strip
                key={s.biome}
                src={`/layers/${s.biome}_${kind}.webp`}
                travel={WORLD_LENGTH * LAYER_SPEED[kind]}
                tileWidth={tileWidth}
                opacity={biomeOpacity(s.at, worldAt)}
                anchor={
                  s.biome === 'b5'
                    ? cliffAnchor * LAYER_SPEED[kind]
                    : 'anchored' in s && s.anchored.includes(kind)
                      ? centredAnchor(s.at, LAYER_SPEED[kind], tileWidth)
                      : undefined
                }
              />
            ))}
          </div>
        ))}

        {phase === 'entering' || phase === 'ready' ? (
          <div
            ref={actorRef}
            className={`${styles.actor} ${hidden ? styles.actorGone : ''}`}
            style={{ left: phase === 'entering' ? `${ENTRY_FROM}%` : `${actorX}%` }}
          >
            <Character
              state={characterState}
              charHeight={charHeight}
              frame={characterState === 'idle' ? undefined : runFrame}
            />
          </div>
        ) : null}

        <div ref={groundRef} className={`${layerStyles.box} ${styles.ground}`}>
          {SECTIONS.filter((s) => Math.abs(s.at - worldAt) < MOUNT_RADIUS).map((s) => (
            <Strip
              key={s.biome}
              src={`/layers/${s.biome}_ground.webp`}
              travel={WORLD_LENGTH}
              tileWidth={tileWidth}
              opacity={biomeOpacity(s.at, worldAt)}
              anchor={s.biome === 'b5' ? cliffAnchor : undefined}
            />
          ))}
        </div>

        <Inventory title="Proyectos" projects={PROJECTS} openness={chestOpen} />
        <Book title="Sobre mí" pages={ABOUT_PAGES} openness={bookOpen} />
        <CraftingTable openness={benchOpen} />

        {/* Las secciones viajan con el suelo: son lugares, no pantallas. */}
        <div ref={markersRef} className={styles.markers}>
          {SECTIONS.slice(1).map((section) => (
            <section
              key={section.id}
              id={section.id}
              className={styles.marker}
              style={{ left: section.at * WORLD_LENGTH }}
            >
              {section.id === 'sobre-mi' || section.id === 'skills' ? null : section.id ===
                'contacto' ? (
                <Signs openness={signsOpen} />
              ) : section.id === 'proyectos' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chestOpen > 0.4 ? '/textures/chest_open.png' : '/textures/chest_closed.png'}
                  alt=""
                  className={styles.chest}
                />
              ) : (
                <>
                  <span className={styles.markerEyebrow}>{section.label}</span>
                  <p className={styles.markerText}>Contenido pendiente</p>
                </>
              )}
            </section>
          ))}
        </div>

        {phase === 'greeting' ? (
          <div className={styles.greeter}>
            <SpriteGrid
              src="/sprites/peek_wave.webp"
              {...PEEK}
              scale={peekScale}
              onFinish={handleGreetingEnd}
              label="Vicente Araya asomándose y saludando"
            />
          </div>
        ) : null}

        <div className={`${styles.titles} ${titleClass}`}>
          <h1 className={styles.name}>Vicente Araya</h1>
          <span className={styles.splash}>{splash}</span>
          <span className={styles.role}>Desarrollador full-stack</span>
        </div>

        <nav
          className={`${styles.nav} ${phase === 'ready' ? styles.navIn : ''}`}
          aria-label="Secciones"
        >
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`${styles.navButton} ${active === section.id ? styles.navActive : ''}`}
              onClick={() => navigate(section)}
              aria-current={active === section.id ? 'true' : undefined}
            >
              {section.label}
            </button>
          ))}
          <button
            type="button"
            className={styles.navButton}
            onClick={() => {
              const next = !muted
              setMuted(next)
              setMutedState(next)
              if (!next) play('button')
            }}
            aria-pressed={muted}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            title={muted ? 'Activar sonido' : 'Silenciar'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </nav>

        <div className={`${styles.loader} ${phase !== 'loading' ? styles.loaderDone : ''}`}>
          <span className={styles.loaderTitle}>Cargando mundo</span>
          <div
            className={styles.bar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label="Cargando mundo"
          >
            {Array.from({ length: BAR_CELLS }, (_, index) => (
              <span key={index} className={`${styles.cell} ${index < filled ? styles.cellOn : ''}`} />
            ))}
          </div>
          <span className={styles.loaderHint}>Generando terreno</span>
        </div>
      </div>

      <EnderPearl shot={shot} />
    </main>
  )
}
