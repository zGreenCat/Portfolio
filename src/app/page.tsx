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
import Weather, { type WeatherKind } from '@/components/Weather'
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
/** Umbrales de marcha, en bloques por segundo. `walk` cubre 1,25 bloques en
 *  25 frames: por encima de ~2 b/s su ciclo se dispara, así que ahí ya corre. */
const SPEED_RUN = 2.2
const SPEED_WALK = 0.45
/** Tope de fotogramas por segundo de las hojas del personaje.
 *
 *  El ciclo va atado a la distancia recorrida para que los pies no patinen,
 *  pero sin tope un golpe de rueda lo dispara a cientos de fps y parece un
 *  fallo.
 *
 *  El tope va aquí y no en la velocidad del mundo: frenando el mundo, este se
 *  quedaba por detrás del scroll y seguía avanzando durante segundos después
 *  de soltar. A cambio, en un golpe muy fuerte los pies patinan un instante —
 *  con todo pasando a esa velocidad, no se aprecia. */
const MAX_SHEET_FPS = 34
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
/** Alto del personaje como fracción del alto del MUNDO, no de la pantalla. */
const CHAR_HEIGHT_VH = 0.1986
/** En vertical el mundo no ocupa toda la pantalla: escalarlo al alto dejaba
 *  ver 5 bloques y el personaje se comía el 40% del ancho. Ocupando la franja
 *  baja entra el triple de mundo y queda cielo arriba, que es donde vive el
 *  título. */
const PORTRAIT_WORLD = 0.46
/** Por debajo de este ancho se usan las capas a mitad de resolución. */
const HALF_RES_WIDTH = 900
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
  {
    id: 'sobre-mi',
    label: 'Sobre mí',
    at: 0.24,
    biome: 'b2',
    surfaceY: 1267,
    kinds: ALL_KINDS,
    weather: 'snow' as WeatherKind,
  },
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
    weather: 'sand' as WeatherKind,
  },
  {
    id: 'skills',
    label: 'Skills',
    at: 0.74,
    biome: 'b4',
    surfaceY: 1278,
    kinds: ALL_KINDS,
    weather: 'petals' as WeatherKind,
  },
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

/** Tramo de mundo, en unidades de progreso, en el que el personaje sube o baja
 *  entre las superficies de dos biomas. El terreno cambia de golpe —como en el
 *  juego— pero un salto de 37 px en los pies sí se notaría. */
const FEET_EASE = 0.03
/** Fuera de este radio el bioma se desmonta: cuatro capas de 3840×1440 son
 *  ~88 MB de memoria descomprimida, y cinco biomas a la vez matan un móvil. */
const MOUNT_RADIUS = 0.34

/** Distancias de apertura de los paneles, en unidades de progreso del mundo.
 *  Se cierran más lejos de lo que se abren: sin esa histéresis, un roce de
 *  rueda mientras lees el panel lo haría parpadear. */
const PANEL_OPEN_AT = 0.058
const PANEL_CLOSE_AT = 0.098

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
 * Territorio de cada bioma, en progreso de mundo. La frontera cae a mitad de
 * camino entre dos secciones.
 *
 * Cada bioma se **recorta** a su territorio en vez de fundirse con el vecino.
 * Fundir mostraba los dos terrenos a la vez —cactus sobre cerezos— y además
 * dejaba pasar el cielo, porque dos capas al 50% componen un 75%, no un 100%.
 *
 * Una frontera dura tampoco es una concesión: en Minecraft los biomas cambian
 * de golpe.
 */
function makeBounds(viewport: number) {
  const bounds = SECTIONS.map((section, i) => {
    const prev = SECTIONS[i - 1]
    const next = SECTIONS[i + 1]
    return {
      from: prev ? (prev.at + section.at) / 2 : -Infinity,
      to: next ? (section.at + next.at) / 2 : Infinity,
    }
  })

  // La primera frontera se empuja más allá del borde derecho de la pantalla:
  // con el bioma de inicio midiendo menos de un viewport, se veía el siguiente
  // nada más entrar, antes de haber caminado nada.
  const clear = (viewport * 1.12) / WORLD_LENGTH
  if (bounds[0].to < clear) {
    bounds[0].to = clear
    bounds[1].from = clear
  }
  return bounds
}

let BOUNDS = makeBounds(1920)

/** Índice del bioma que pisas, y cuánto has entrado en el siguiente. */
function biomeAt(world: number): { index: number; blend: number; next: number } {
  let index = 0
  BOUNDS.forEach((b, i) => {
    if (world >= b.from) index = i
  })
  const edge = BOUNDS[index].to
  const next = Math.min(SECTIONS.length - 1, index + 1)
  const blend =
    edge === Infinity ? 0 : Math.min(1, Math.max(0, (world - (edge - FEET_EASE)) / FEET_EASE))
  return { index, blend, next }
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
  const [worldPx, setWorldPx] = useState(0)
  const [half, setHalf] = useState(false)
  const [weather, setWeather] = useState<{ kind: WeatherKind | null; power: number }>({
    kind: null,
    power: 0,
  })
  /** Avance del mundo en el último frame: arrastra las partículas. */
  const worldDeltaRef = useRef(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [compact, setCompact] = useState(false)
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
  /** Pide al bucle que salte sin suavizado ni tope: es un teletransporte. */
  const snapRef = useRef(false)

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
      const portrait = window.innerHeight > window.innerWidth
      const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
      setWorldPx(world)
      setHalf(window.innerWidth < HALF_RES_WIDTH)
      BOUNDS = makeBounds(window.innerWidth)
      setCompact(window.innerWidth <= 760)
      setCharHeight(world * CHAR_HEIGHT_VH)
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
    const stride = BLOCK_PX_SOURCE * (worldPx / LAYER_HEIGHT_SOURCE) * STRIDE.walk
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
  }, [phase, worldPx])

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

    const block = BLOCK_PX_SOURCE * (worldPx / LAYER_HEIGHT_SOURCE)
    let previous = 0
    let last = performance.now()
    let sheetFrame = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      if (snapRef.current) {
        // La perla no camina: llega.
        snapRef.current = false
        current = target
        previous = current * WORLD_LENGTH
      } else {
        // Suavizado, sin tope: el mundo sigue al scroll y se detiene cuando
        // tú te detienes.
        current += (target - current) * 0.12
        if (Math.abs(target - current) < 0.00002) current = target
      }

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
      const travelled = worldX - previous
      worldDeltaRef.current = travelled
      const speed = dt > 0 ? Math.abs(travelled) / dt / block : 0
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
      // El avance del ciclo sale de la distancia, pero acotado: así los pies
      // no patinan a velocidad normal y no se dispara en un golpe fuerte.
      const wanted = (travelled / stride) * FRAME_COUNT[active]
      const cap = MAX_SHEET_FPS * dt
      sheetFrame += Math.max(-cap, Math.min(cap, wanted))
      setRunFrame(Math.floor(sheetFrame))
      setStarted(current > 0.004)
      setWorldAt(current)
      setNight(Math.min(1, Math.max(0, (current - DUSK_FROM) / (NIGHT_AT - DUSK_FROM))))

      // Se abre el encuadre al acercarse al acantilado.
      const toCliff = Math.min(1, Math.max(0, (current - CLIFF_FROM) / (1 - CLIFF_FROM)))
      setActorX(ENTRY_TO + (CLIFF_X - ENTRY_TO) * toCliff)

      // El terreno cambia de golpe en la frontera, pero los pies no: se
      // interpolan en un tramo corto para que no den un salto de 37 px.
      const { index, blend, next } = biomeAt(current)

      // El clima se desvanece cerca de la frontera en vez de cortarse: nieve
      // que para en una línea vertical se lee como un fallo.
      const here = SECTIONS[index]
      const there = SECTIONS[next]
      const own = 'weather' in here ? here.weather : null
      const upcoming = 'weather' in there ? there.weather : null
      if (blend > 0.5 && upcoming) setWeather({ kind: upcoming, power: (blend - 0.5) * 2 })
      else if (own) setWeather({ kind: own, power: Math.max(0, 1 - blend * 2) })
      else setWeather({ kind: upcoming ?? null, power: upcoming ? Math.max(0, blend * 2 - 1) : 0 })
      const feetOf = (i: number) =>
        (LAYER_HEIGHT_SOURCE - (SECTIONS[i].surfaceY + FEET_BELOW_SURFACE)) / LAYER_HEIGHT_SOURCE
      setFeetVh(feetOf(index) + (feetOf(next) - feetOf(index)) * blend)

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
  }, [phase, worldPx])

  /**
   * Dónde aterriza la perla. No es exactamente la sección: caer justo encima
   * deja la siguiente frontera de bioma dentro del cuadro.
   *
   * La frontera aparece en pantalla en `edge - worldX`, medido desde el borde
   * IZQUIERDO. Para dejarla fuera hay que retroceder un viewport entero, no el
   * hueco que queda a la derecha del personaje.
   *
   * El retroceso está acotado por `PANEL_OPEN_AT`: más atrás de eso, llegarías
   * con el cofre entreabierto.
   */
  const landingFor = useCallback((index: number) => {
    const section = SECTIONS[index]
    const edge = BOUNDS[index].to
    if (edge === Infinity) return section.at
    const clear = edge - window.innerWidth / WORLD_LENGTH
    return Math.max(section.at - PANEL_OPEN_AT, Math.min(section.at, clear))
  }, [])

  const jumpTo = useCallback((at: number, id: string) => {
    snapRef.current = true
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
        jumpTo(landingFor(SECTIONS.indexOf(section)), section.id)
        return
      }
      play('button')
      setMenuOpen(false)
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
        toY: window.innerHeight - feetVh * worldPx,
        onCross: () => {
          // Se desvanece al salir la perla de plano, no al lanzarla: si no,
          // se queda un hueco vacío en la pantalla de origen.
          setHidden(true)
          jumpTo(landingFor(SECTIONS.indexOf(section)), section.id)
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
    [jumpTo, landingFor, feetVh, charHeight, actorX, worldPx],
  )

  const handleGreetingEnd = useCallback(() => setPhase('entering'), [])

  const filled = Math.round(progress * BAR_CELLS)
  const titleClass = started ? styles.titlesOut : phase === 'ready' ? styles.titlesIn : ''
  const tileWidth = (worldPx || 1080) * LAYER_ASPECT
  /**
   * Bordes del territorio de un bioma, en píxeles del contenedor de su capa.
   *
   * Lleva el término `-worldX*(1-speed)` para que la frontera caiga en la
   * MISMA x de pantalla en todas las capas. Sin él, cada capa cortaba el bioma
   * en un sitio distinto —el fondo mucho antes que el suelo— y se veía taiga
   * detrás de bosque. La frontera es una línea vertical que se cruza andando,
   * y detrás de ella el parallax sigue funcionando con normalidad.
   */
  const clipOf = (i: number, speed: number) => {
    const worldX = worldAt * WORLD_LENGTH
    const shift = worldX * (1 - speed)
    return {
      clipFrom: BOUNDS[i].from === -Infinity ? -1e7 : BOUNDS[i].from * WORLD_LENGTH - shift,
      clipTo: BOUNDS[i].to === Infinity ? 1e7 : BOUNDS[i].to * WORLD_LENGTH - shift,
    }
  }
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
          '--char-feet': `${feetVh * worldPx}px`,
          '--world-h': `${worldPx}px`,
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
                opacity={1}
                {...clipOf(SECTIONS.indexOf(s), LAYER_SPEED[kind])}
                half={half}
                extend={s.biome === 'b5' ? 2 : 0}
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
              opacity={1}
              {...clipOf(SECTIONS.indexOf(s), LAYER_SPEED.ground)}
              half={half}
              extend={s.biome === 'b5' ? 2 : 0}
              anchor={s.biome === 'b5' ? cliffAnchor : undefined}
            />
          ))}
        </div>

        <Inventory title="Proyectos" projects={PROJECTS} openness={chestOpen} />
        <Book title="Sobre mí" pages={ABOUT_PAGES} openness={bookOpen} />
        <CraftingTable openness={benchOpen} />

        {/* Las secciones viajan con el suelo: son lugares, no pantallas.
            Solo las que tienen algo físico en el mundo: el libro, la mesa y el
            inventario son paneles y se dibujan aparte. */}
        <div ref={markersRef} className={styles.markers}>
          {SECTIONS.filter((section) => section.id === 'proyectos' || section.id === 'contacto').map(
            (section) => (
              <section
                key={section.id}
                id={section.id}
                className={styles.marker}
                style={{ left: section.at * WORLD_LENGTH }}
              >
                {section.id === 'contacto' ? (
                  <Signs openness={signsOpen} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chestOpen > 0.4 ? '/textures/chest_open.png' : '/textures/chest_closed.png'}
                    alt=""
                    className={styles.chest}
                  />
                )}
              </section>
            ),
          )}
        </div>

        <Weather kind={weather.kind} intensity={weather.power} worldDeltaRef={worldDeltaRef} />

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
          <button
            type="button"
            className={`${styles.navButton} ${styles.navToggle}`}
            onClick={() => {
              play('button')
              setMenuOpen((open) => !open)
            }}
            aria-expanded={menuOpen}
            aria-controls="nav-items"
          >
            {menuOpen ? '✕ Cerrar' : '☰ Menú'}
          </button>

          <div id="nav-items" className={styles.navItems} hidden={compact && !menuOpen}>
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
            >
              {muted ? '🔇 Sonido' : '🔊 Sonido'}
            </button>
          </div>
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
