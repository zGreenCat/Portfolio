'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import Character, {
  CELL_WIDTH,
  FRAME_COUNT,
  SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from '@/components/Character'
import EnderPearl, { type PearlThrow } from '@/components/EnderPearl'
import Book from '@/components/Book'
import CraftingTable from '@/components/CraftingTable'
import Inventory from '@/components/Inventory'
import NightSky, { skyAt } from '@/components/NightSky'
import Signs from '@/components/Signs'
import type { WeatherState } from '@/components/Weather'
import { BLOCK_PX_SOURCE, GROUND_BELOW, LAYER_HEIGHT, WORLD_UNIT } from '@/content/layers'
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
/** El ancho de una tesela, en unidades de la caja del mundo. */
const LAYER_ASPECT = 3840 / WORLD_UNIT
/** Bloques que avanza cada ciclo. Caminar cubre menos suelo por zancada, así
 *  que su ciclo tiene que ir más apretado o los pies patinan. */
const STRIDE: Record<CharacterState, number> = { run: 2.1, walk: 1.25, idle: 1, throw: 1, sit: 1 }
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
/** Alto del personaje como fracción de la caja del mundo. Medido sobre la
 *  pasada `ref`, que trae al personaje colocado a escala de mundo: 271 px. */
const CHAR_HEIGHT_VH = 271 / WORLD_UNIT
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
/** Cuánto se hunde el pie por debajo de la superficie. Medido sobre la `ref`:
 *  pies en la fila 2738 con la superficie en 2716. */
const FEET_BELOW_SURFACE = 22
const CHAR_FEET_VH = (GROUND_BELOW - FEET_BELOW_SURFACE) / WORLD_UNIT
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
  { id: 'inicio', label: 'Inicio', at: 0, biome: 'b1', surfaceY: 2716, kinds: ALL_KINDS },
  {
    id: 'sobre-mi',
    label: 'Sobre mí',
    at: 0.24,
    biome: 'b2',
    surfaceY: 2705,
    kinds: ALL_KINDS,
    fog: true,
    weather: 'snow' as WeatherKind,
  },
  // El templo del desierto no se tesela: es un edificio, y los edificios no
  // se repiten cada 300 metros. Va anclado a la sección.
  {
    id: 'proyectos',
    label: 'Proyectos',
    at: 0.52,
    biome: 'b3',
    surfaceY: 2716,
    kinds: ALL_KINDS,
    anchored: ['far'] as readonly string[],
    fog: true,
    weather: 'sand' as WeatherKind,
  },
  {
    id: 'skills',
    label: 'Skills',
    at: 0.74,
    biome: 'b4',
    surfaceY: 2716,
    kinds: ALL_KINDS,
    weather: 'petals' as WeatherKind,
  },
  // El acantilado es el final del mundo: una sola copia anclada, sin repetir,
  // y sin capas intermedias porque ahí ya no hay recorrido que acompañar.
  { id: 'contacto', label: 'Contacto', at: 0.96, biome: 'b5', surfaceY: 2716, kinds: END_KINDS },
] as const

/** Fracción de la tesela donde se acaba el suelo del acantilado. */
const CLIFF_EDGE = 2371 / 3840
/** En el acantilado el personaje se desplaza hacia el centro. El árbol queda
 *  772 px a la izquierda del borde del vacío, y con él al 20% se salía de
 *  cuadro. Además, encuadrar más abierto sienta mejor a un final. */
const CLIFF_X = 48
const CLIFF_FROM = 0.84
/**
 * Sentarse es lo único del recorrido que NO va atado a la posición: es un gesto
 * que se hace en el sitio al llegar al borde, no algo que se rasque con la
 * rueda. Avanza por tiempo y se queda en el último frame.
 *
 * Retroceder lo reproduce hacia atrás al mismo ritmo, así que el personaje se
 * levanta en vez de saltar de golpe a estar de pie.
 */
const SIT_AT = 0.998
/** Hay que retroceder de verdad para que se levante. Sin esta holgura, un roce
 *  de rueda en el borde bajaba del umbral y arrancaba el gesto contrario al
 *  instante: ir y venir así se lee como si la animación siguiera a la rueda. */
const SIT_RELEASE = 0.97
const SIT_SECONDS = 1.35
/** Tope de velocidad, en bloques por segundo, SOLO para recuperar la distancia
 *  que se acumuló mientras el mundo estaba congelado. El suavizado normal sigue
 *  sin tope: ponérselo a todo ya causó sensación de lag en su día. */
const CATCH_UP_BLOCKS = 14

/** Tramo de mundo, en unidades de progreso, en el que el personaje sube o baja
 *  entre las superficies de dos biomas. El terreno cambia de golpe —como en el
 *  juego— pero un salto de 37 px en los pies sí se notaría. */
const FEET_EASE = 0.03
/** Fuera de este radio el bioma se desmonta: cuatro capas de 3840×1440 son
 *  ~88 MB de memoria descomprimida, y cinco biomas a la vez matan un móvil. */
const MOUNT_RADIUS = 0.34
/** Radio en el que un bioma se descomprime por adelantado, antes de montarse.
 *  Descomprimir una capa de 3840×1440 cuesta bastante y caía justo al cruzar
 *  la frontera; adelantarlo lo mete en un tramo tranquilo. */
const PREWARM_RADIUS = MOUNT_RADIUS + 0.14
const PREWARM_DROP = PREWARM_RADIUS + 0.05

/** Escalones de la noche y de la apertura de paneles. Los dos alimentan estado
 *  de React: cuantizarlos convierte 60 re-render/s en unos pocos por tramo. La
 *  noche además mueve un `filter` sobre superficies del ancho del mundo. */
const NIGHT_STEPS = 24
const PANEL_STEPS = 20

const quantize = (value: number, steps: number) => Math.round(value * steps) / steps

const layerSrc = (biome: string, kind: string, half: boolean) =>
  `/layers/${biome}_${kind}${half ? '@half' : ''}.webp`

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
  /** Si el sistema pide menos movimiento, la versión en texto deja de ser un
   *  enlace más de la barra y se señala: ya dijeron que no quieren esto. */
  const [reduced, setReduced] = useState(false)
  const [worldPx, setWorldPx] = useState(0)
  const [viewW, setViewW] = useState(1920)
  const [half, setHalf] = useState(false)
  /** Biomas montados, por índice. Solo cambia al cruzar un radio, no por frame. */
  const [mounted, setMounted] = useState<number[]>([0])
  /** Avance del mundo en el último frame: arrastra las partículas. */
  const worldDeltaRef = useRef(0)
  /**
   * Todo lo que cambia en cada frame vive en refs y se escribe al DOM a mano.
   * Como estado de React obligaba a reconciliar el árbol entero —cuatro capas,
   * sus tiras y todas sus teselas— sesenta veces por segundo.
   */
  const worldAtRef = useRef(0)
  const actorXRef = useRef(ENTRY_TO)
  const feetVhRef = useRef(CHAR_FEET_VH)
  const weatherRef = useRef<WeatherState>({ kind: null, power: 0 })
  const mountKeyRef = useRef('0')
  /** Fuerza actual de la tormenta de arena, ya cuantizada. */
  const sandRef = useRef(-1)
  /** Niebla de distancia. Solo la llevan la nieve y el desierto; en el bosque y
   *  los cerezos el fondo se lee limpio. Se persigue con un suavizado en vez de
   *  atarla a la frontera: aparecer de golpe en la línea del bioma canta. */
  const fogRef = useRef(0)
  const fogWrittenRef = useRef(-1)
  /** Hacia dónde mira: 1 derecha, -1 izquierda. */
  const facingRef = useRef(1)
  /** Cuánto ha entrado en el gesto de sentarse, 0 a 1. Avanza por tiempo. */
  const sitRef = useRef(0)
  /** Si toca estar sentado. Cambia con histéresis, no en un solo umbral. */
  const sitWantRef = useRef(false)
  /** Sentido del gesto en curso: +1 sentándose, -1 levantándose. */
  const sitDirRef = useRef(-1)
  /** Posición del mundo congelada mientras dura el gesto, o null si no lo hay. */
  const sitLockRef = useRef<number | null>(null)
  /** Recuperando la distancia acumulada mientras el mundo estuvo congelado. */
  const catchUpRef = useRef(false)
  /**
   * Sección a la que volver al recargar, o null si es una visita limpia.
   *
   * El navegador restaura el scroll solo, y lo deja en el píxel exacto donde
   * estabas: si eso cae entre dos biomas, apareces plantado en la franja de la
   * frontera. Aquí se redondea a la sección más cercana para llegar a un sitio
   * que sea un lugar y no una coordenada.
   */
  const resumeRef = useRef<number | null>(null)
  /** Tiras montadas con su geometría ya leída: el recorte se reescribe en cada
   *  frame y no conviene volver a consultar el DOM para eso. */
  const stripsRef = useRef<
    { el: HTMLElement; from: number; to: number; speed: number; left: number; width: number }[]
  >([])
  /** Capas ya descomprimidas y retenidas. Sin esto, el decode de una imagen de
   *  3840×1440 caía justo al cruzar la frontera y ahí se veía el tirón. */
  const warmRef = useRef(new Map<string, HTMLImageElement>())
  const [menuOpen, setMenuOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  /** La noche va cuantizada: cambiarla mueve un `filter` CSS sobre superficies
   *  del ancho del mundo, y re-filtrar eso en cada frame era carísimo. */
  const [night, setNight] = useState(0)

  const rootRef = useRef<HTMLElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
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
  useEffect(() => setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches), [])

  /**
   * Escribe el frame del sprite sobre el nodo. El ciclo va atado al avance real
   * del mundo, así que cambia en cada frame: como prop, re-renderizaba.
   *
   * La hoja se lee del propio nodo, NO de `stateRef`. El cambio de estado llega
   * al DOM cuando React re-renderiza, un frame más tarde, y en esa ventana las
   * dos fuentes discrepan: `run` mide 367 px de alto en 16 celdas y `walk` 399
   * en 25, así que el ancho de celda no coincide y el corte cae en mitad de un
   * frame. Se veían dos poses a la vez.
   */
  const writeFrame = useCallback(
    (index: number) => {
      const node = spriteRef.current
      const shown = node?.dataset.state as CharacterState | undefined
      if (!node || !shown) return
      const sheet = SHEET_GEOMETRY[shown]
      const width = CELL_WIDTH * ((worldPx * CHAR_HEIGHT_VH) / sheet.charHeight)
      const wrapped = ((index % sheet.frames) + sheet.frames) % sheet.frames
      node.style.backgroundPositionX = `${-wrapped * width}px`
    },
    [worldPx],
  )

  /**
   * En reposo el ciclo vuelve al CSS, y hay que borrar el frame que dejó el
   * bucle. El keyframe solo declara `to`, así que el `from` implícito sale del
   * valor que haya puesto: con el inline viejo, el ciclo arrancaba desalineado.
   */
  useEffect(() => {
    if (characterState === 'idle' && spriteRef.current) {
      spriteRef.current.style.backgroundPositionX = ''
    }
  }, [characterState])

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
      writeFrame(Math.floor(t * FRAME_COUNT.throw))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [characterState, writeFrame])

  /**
   * Se calcula al terminar la carga, no antes: hay que leer el scroll ya
   * restaurado por el navegador. La posición manda sobre el hash porque refleja
   * dónde estabas de verdad; el hash solo entra si no hay scroll, que es el
   * caso de un enlace compartido abierto en frío.
   */
  const resumeTarget = useCallback(() => {
    const progress = window.scrollY / SCROLL_LENGTH
    if (progress > 0.01) {
      let best = 0
      SECTIONS.forEach((section, i) => {
        if (Math.abs(section.at - progress) < Math.abs(SECTIONS[best].at - progress)) best = i
      })
      return best
    }
    const hash = window.location.hash.slice(1)
    const byHash = SECTIONS.findIndex((section) => section.id === hash)
    return byHash > 0 ? byHash : null
  }, [])

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

  /**
   * Prepara la vuelta: monta el bioma de destino, mueve el documento y deja la
   * posición lista para que la coloque la entrada. Devuelve false si es una
   * visita limpia y toca saludar.
   */
  const armResume = useCallback(() => {
    const index = resumeTarget()
    if (index === null) return false
    const at = landingFor(index)
    resumeRef.current = at

    // El bioma tiene que estar montado antes de colocar el mundo: si no, no hay
    // tiras que recortar y la caminata ocurre sobre el terreno equivocado.
    const near: number[] = []
    SECTIONS.forEach((section, i) => {
      if (Math.abs(section.at - at) < MOUNT_RADIUS) near.push(i)
    })
    mountKeyRef.current = near.join(',')
    setMounted(near)
    setActive(SECTIONS[index].id)
    window.history.replaceState(null, '', `#${SECTIONS[index].id}`)
    window.scrollTo({ top: at * SCROLL_LENGTH, behavior: 'auto' })
    return true
  }, [landingFor, resumeTarget])

  // --- carga ---
  useEffect(() => {
    let cancelled = false
    const t0 = performance.now()
    let done = 0
    // La carga sale por dos puertas —todas las imágenes, o el tope de tiempo— y
    // solo puede salir por una: la segunda volvería a armar el reaterrizaje
    // cuando el bucle ya lo consumió.
    let settled = false

    const enter = () => {
      if (cancelled) return
      window.setTimeout(
        () => {
          if (cancelled || settled) return
          settled = true
          window.clearTimeout(cap)
          // Quien vuelve ya te vio saludar. La entrada caminando y el reposo sí
          // se quedan: son lo que planta al personaje en el suelo.
          setPhase(armResume() ? 'entering' : 'greeting')
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

    const cap: number = window.setTimeout(() => {
      if (cancelled || settled) return
      settled = true
      setPhase(armResume() ? 'entering' : 'greeting')
    }, MAX_LOADING_MS)

    return () => {
      cancelled = true
      window.clearTimeout(cap)
    }
  }, [armResume])

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
      setViewW(window.innerWidth)
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

  // Releer la geometría de las tiras montadas. El recorte se reescribe en cada
  // frame y consultar el DOM ahí dentro sería absurdo.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-strip]'))
    stripsRef.current = nodes.map((el) => ({
      el,
      from: Number(el.dataset.from),
      to: Number(el.dataset.to),
      speed: Number(el.dataset.speed),
      left: Number(el.dataset.left),
      width: Number(el.dataset.width),
    }))
  }, [mounted, half, worldPx, viewW, phase])

  /**
   * Coloca el mundo en una posición: desplazamiento de capas, recorte de cada
   * bioma, altura de los pies y hora del día.
   *
   * Lo comparten el bucle y el reaterrizaje al volver. Antes esto solo existía
   * dentro del bucle, y como el bucle no arranca hasta `ready`, quien volvía
   * veía el bioma inicial durante toda la caminata de entrada y un cambio de
   * fondo de golpe al terminar.
   */
  const placeWorld = useCallback(
    (at: number) => {
      worldAtRef.current = at
      const worldX = at * WORLD_LENGTH
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

      // El término (1-speed) hace que la frontera caiga en la MISMA x de
      // pantalla en todas las capas pese a que cada una corre a su ritmo. Sin
      // él, el fondo cortaba el bioma mucho antes que el suelo.
      stripsRef.current.forEach((strip) => {
        const shift = worldX * (1 - strip.speed)
        const right = Math.max(0, strip.width - (strip.to - shift - strip.left))
        const inset = Math.max(0, strip.from - shift - strip.left)
        strip.el.style.clipPath = `inset(0 ${right}px 0 ${inset}px)`
      })

      const spot = biomeAt(at)
      // Ya no depende del bioma: la importación recorta cada capa a la misma
      // distancia bajo su superficie, así que el suelo cae siempre a la misma
      // altura de pantalla y cruzar de bioma no da un escalón.
      const feet = CHAR_FEET_VH
      feetVhRef.current = feet
      rootRef.current?.style.setProperty('--char-feet', `${feet * worldPx}px`)

      const dark = Math.min(1, Math.max(0, (at - DUSK_FROM) / (NIGHT_AT - DUSK_FROM)))
      setNight(quantize(dark, NIGHT_STEPS))
      return spot
    },
    [worldPx],
  )

  // --- entrada al mundo ---
  useEffect(() => {
    if (phase !== 'entering') return
    const actor = actorRef.current
    if (!actor) return

    // Colocar el mundo ANTES de la caminata: quien vuelve tiene que entrar ya
    // en su bioma, no verse trasladado al acabar de andar.
    if (resumeRef.current !== null) placeWorld(resumeRef.current)

    stateRef.current = 'walk'
    setCharacterState('walk')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      actor.style.left = `${ENTRY_TO}%`
      setPhase('ready')
      return
    }

    const distance = ((ENTRY_TO - ENTRY_FROM) / 100) * window.innerWidth
    const stride = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT) * STRIDE.walk
    const t0 = performance.now()
    let raf = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / (ENTRY_SECONDS * 1000))
      const eased = 1 - (1 - t) ** 3
      actor.style.left = `${ENTRY_FROM + (ENTRY_TO - ENTRY_FROM) * eased}%`
      writeFrame(Math.floor(((eased * distance) / stride) * FRAME_COUNT.walk))
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
  }, [phase, worldPx, writeFrame, placeWorld])

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
      // Cortar el bucle CSS ya, sin esperar al re-render: si no, durante ese
      // frame la animación de reposo sigue corriendo sobre el valor que acaba
      // de escribir el bucle y arrastra el sprite entre dos celdas.
      if (next !== 'idle' && spriteRef.current) spriteRef.current.dataset.driven = 'true'
      setCharacterState(next)
    }

    const read = () => {
      target = Math.min(1, Math.max(0, window.scrollY / SCROLL_LENGTH))
    }

    const block = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT)
    let previous = 0
    let last = performance.now()
    let sheetFrame = 0

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const before = current

      if (snapRef.current) {
        // La perla no camina: llega.
        snapRef.current = false
        current = target
        previous = current * WORLD_LENGTH
        // Y cancela el gesto: no tiene sentido levantarse de un sitio en el que
        // ya no estás. Sin esto el mundo se quedaba congelado en el acantilado.
        sitRef.current = 0
        sitLockRef.current = null
        sitDirRef.current = -1
        sitWantRef.current = false
        catchUpRef.current = false
      } else {
        // Suavizado, sin tope: el mundo sigue al scroll y se detiene cuando
        // tú te detienes.
        current += (target - current) * 0.12
        if (Math.abs(target - current) < 0.00002) current = target
      }

      /*
       * El personaje se sienta y se levanta EN EL SITIO: mientras dure el gesto
       * —y mientras siga sentado— la posición del mundo queda clavada donde
       * llegó. Sin esto, al retroceder se iba hacia atrás mientras se levantaba.
       *
       * Usa el `sitRef` del frame anterior. Eso evita subir el bloque del gesto
       * por delante de `placeWorld`, que es lo que rompió el intento previo; el
       * desfase de un frame no se ve en un gesto de segundo y medio.
       */
      if (sitRef.current > 0) {
        if (sitLockRef.current === null) sitLockRef.current = current
        current = sitLockRef.current
      } else {
        // Al soltar, el scroll puede haberse ido lejos mientras el mundo estaba
        // quieto. Se marca para recuperarlo con tope en vez de de un salto.
        if (sitLockRef.current !== null && Math.abs(target - sitLockRef.current) > 0.002) {
          catchUpRef.current = true
        }
        sitLockRef.current = null
      }

      /*
       * Recuperación acotada. Sin esto el primer frame tras levantarse cierra
       * cientos de píxeles de golpe y el personaje sale disparado hacia atrás.
       * El tope va en bloques por segundo, así que no depende de la resolución.
       */
      if (catchUpRef.current) {
        const step = current - before
        const cap = (CATCH_UP_BLOCKS * block * dt) / WORLD_LENGTH
        if (Math.abs(step) > cap) current = before + Math.sign(step) * cap
        if (Math.abs(target - current) < 0.0005) catchUpRef.current = false
      }

      const worldX = current * WORLD_LENGTH
      // Capas, recortes, pies y hora del día. Lo mismo que usa el reaterrizaje.
      const { index, blend, next } = placeWorld(current)

      // Tres marchas por velocidad de avance: correr, caminar, parado.
      const travelled = worldX - previous
      worldDeltaRef.current = travelled
      const speed = dt > 0 ? Math.abs(travelled) / dt / block : 0
      previous = worldX
      if (speed <= SPEED_WALK) stillFor += 1
      else stillFor = 0

      /*
       * Sentarse y levantarse son dos gestos, no un control continuo, y sus
       * condiciones son asimétricas a propósito:
       *
       *   sentarse   depende de haber LLEGADO   → mira `current`
       *   levantarse depende de que te hayas IDO → mira `target`
       *
       * Mirar `target` para sentarse lo disparaba al tocar fondo el scroll,
       * antes de que el personaje llegara al borde. Y mirar `current` para
       * levantarse no funciona porque con el mundo congelado deja de moverse.
       *
       * El orden importa: sentado, `current >= SIT_AT` es cierto siempre, así
       * que la condición de levantarse tiene que evaluarse primero.
       */
      if (target < SIT_RELEASE) sitWantRef.current = false
      else if (current >= SIT_AT) sitWantRef.current = true

      // El sentido solo se replantea con el gesto en reposo —en 0 o en 1—, así
      // que a media animación se termina lo empezado en vez de darse la vuelta.
      if (sitRef.current === 0 || sitRef.current === 1) {
        sitDirRef.current = sitWantRef.current ? 1 : -1
      }
      sitRef.current = Math.min(
        1,
        Math.max(0, sitRef.current + (sitDirRef.current * dt) / SIT_SECONDS),
      )
      const sitAt = sitRef.current

      if (!teleportingRef.current) {
        // El retardo se cuenta en frames, no con un temporizador: dentro del
        // bucle, un setTimeout se reiniciaba en cada vuelta y no llegaba a
        // cumplirse nunca, así que se quedaba caminando para siempre.
        if (sitAt > 0) applyState('sit')
        else if (stillFor >= IDLE_FRAMES) applyState('idle')
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
      // En valor absoluto: el ciclo siempre corre hacia delante. Con el signo,
      // retroceder lo reproducía al revés y el personaje caminaba de espaldas.
      const wanted = (Math.abs(travelled) / stride) * FRAME_COUNT[active]
      const cap = MAX_SHEET_FPS * dt
      sheetFrame += Math.max(-cap, Math.min(cap, wanted))
      if (active === 'sit') {
        // El frame lo marca la posición, no la distancia recorrida: el gesto
        // tiene principio y final, no es un ciclo.
        writeFrame(Math.min(FRAME_COUNT.sit - 1, Math.floor(sitAt * FRAME_COUNT.sit)))
      } else if (active !== 'idle') {
        // En reposo manda el bucle CSS: escribirle el frame lo dejaría clavado.
        writeFrame(Math.floor(sheetFrame))
      }

      // Retroceder es darse la vuelta, no rebobinar. La banda muerta evita que
      // un temblor de rueda lo haga girar sobre sí mismo. Sentado no se gira:
      // la hoja está dibujada mirando al vacío y voltearla lo pondría de
      // espaldas al horizonte mientras se levanta.
      if (!teleportingRef.current && sitAt === 0 && Math.abs(travelled) > 0.6) {
        const facing = travelled < 0 ? -1 : 1
        if (facing !== facingRef.current) {
          facingRef.current = facing
          if (spriteRef.current) {
            spriteRef.current.style.transform = facing < 0 ? 'scaleX(-1)' : ''
          }
        }
      }
      setStarted(current > 0.004)

      // Se abre el encuadre al acercarse al acantilado.
      const toCliff = Math.min(1, Math.max(0, (current - CLIFF_FROM) / (1 - CLIFF_FROM)))
      const wantX = ENTRY_TO + (CLIFF_X - ENTRY_TO) * toCliff
      actorXRef.current = wantX
      if (actorRef.current) actorRef.current.style.left = `${wantX}%`

      // El clima se desvanece cerca de la frontera en vez de cortarse: nieve
      // que para en una línea vertical se lee como un fallo.
      const here = SECTIONS[index]
      const there = SECTIONS[next]
      const own = 'weather' in here ? here.weather : null
      const upcoming = 'weather' in there ? there.weather : null
      const air = weatherRef.current
      if (blend > 0.5 && upcoming) {
        air.kind = upcoming
        air.power = (blend - 0.5) * 2
      } else if (own) {
        air.kind = own
        air.power = Math.max(0, 1 - blend * 2)
      } else {
        air.kind = upcoming ?? null
        air.power = upcoming ? Math.max(0, blend * 2 - 1) : 0
      }

      /*
       * Rachas. La tormenta sube y baja en vez de quedarse plana, y en las
       * calmas asoma el templo del fondo: taparlo siempre o no taparlo nunca
       * eran las dos malas respuestas.
       *
       * Dos senos de periodo inconmensurable, así no se oye el bucle. Multiplica
       * la fuerza, con lo que arrastra a la vez partículas, velo y visibilidad
       * del fondo: si solo pulsara una de las tres, se notaría el truco.
       */
      if (air.kind === 'sand') {
        const wave = 0.6 * Math.sin(now / 3200) + 0.4 * Math.sin(now / 7900 + 1.7)
        air.power *= 0.45 + 0.55 * (wave * 0.5 + 0.5)
      }

      // La arena también quita visibilidad al fondo, no solo cae. Los velos son
      // del tamaño de la pantalla, así que esto es composición y no re-filtrado.
      const wantFog = 'fog' in SECTIONS[index] ? 1 : 0
      fogRef.current += (wantFog - fogRef.current) * 0.05
      const fog = quantize(fogRef.current, 24)
      if (fog !== fogWrittenRef.current) {
        fogWrittenRef.current = fog
        rootRef.current?.style.setProperty('--fog', `${fog}`)
      }

      const sand = quantize(air.kind === 'sand' ? air.power : 0, 24)
      if (sand !== sandRef.current) {
        sandRef.current = sand
        rootRef.current?.style.setProperty('--sand', `${sand}`)
      }

      // Apertura por distancia: es una función de la posición, no un
      // disparador. Así no hay estado que sincronizar ni re-disparos al volver.
      setChestOpen(quantize(panelOpenness(SECTIONS[2].at, current), PANEL_STEPS))
      setBookOpen(quantize(panelOpenness(SECTIONS[1].at, current), PANEL_STEPS))
      setSignsOpen(quantize(panelOpenness(SECTIONS[4].at, current), PANEL_STEPS))
      setBenchOpen(quantize(panelOpenness(SECTIONS[3].at, current), PANEL_STEPS))
      setActive(
        SECTIONS.reduce((best, s) =>
          Math.abs(s.at - current) < Math.abs(best.at - current) ? s : best,
        ).id,
      )

      // Qué biomas están montados. Solo se toca al cruzar el radio, y ese es el
      // único cambio de estado que rehace el árbol de capas.
      const near: number[] = []
      SECTIONS.forEach((section, i) => {
        if (Math.abs(section.at - current) < MOUNT_RADIUS) near.push(i)
      })
      const key = near.join(',')
      if (key !== mountKeyRef.current) {
        mountKeyRef.current = key
        setMounted(near)
      }

      // Precalentado: descomprime las capas del bioma que viene y retiene la
      // imagen, para que montarla luego no cueste nada. Se sueltan pasado el
      // radio, con holgura, porque son decenas de MB cada una.
      const warm = warmRef.current
      SECTIONS.forEach((section) => {
        const distance = Math.abs(section.at - current)
        section.kinds.forEach((kind) => {
          const src = layerSrc(section.biome, kind, half)
          if (distance < PREWARM_RADIUS) {
            if (!warm.has(src)) {
              const image = new Image()
              warm.set(src, image)
              image.src = src
              void image.decode().catch(() => {})
            }
          } else if (distance > PREWARM_DROP) {
            warm.delete(src)
          }
        })
      })

      raf = requestAnimationFrame(frame)
    }

    const onScroll = read

    read()

    // La vuelta ya dejó el mundo colocado y el documento desplazado antes de la
    // caminata; aquí solo se adopta como punto de partida.
    if (resumeRef.current !== null) {
      target = resumeRef.current
      resumeRef.current = null
      window.scrollTo({ top: target * SCROLL_LENGTH, behavior: 'auto' })
    }

    current = target
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [phase, worldPx, half, writeFrame, placeWorld])


  // Los bytes de todas las capas, en segundo plano y sin descomprimir. Cuando
  // un bioma se monta ya no hay red de por medio: queda solo el decode, y de
  // adelantarlo se encarga el precalentado del bucle. De ahí que la pantalla de
  // carga siga siendo corta pese a que el mundo pesa 8 MB.
  useEffect(() => {
    if (phase === 'loading') return
    let stop = false
    // Las hojas que no bloquean la carga pero sí hacen falta luego: sin esto,
    // `sit` se descarga justo al llegar al acantilado y se nota.
    const rest = [
      '/sprites/walk.webp',
      '/sprites/throw.webp',
      '/sprites/sit.webp',
      ...SECTIONS.flatMap((section) =>
        section.kinds.map((kind) => layerSrc(section.biome, kind, half)),
      ),
    ].filter((src) => !PRELOAD.includes(src))

    const pull = async () => {
      for (const src of rest) {
        if (stop) return
        await fetch(src, { cache: 'force-cache' }).catch(() => {})
      }
    }
    void pull()
    return () => {
      stop = true
    }
  }, [phase, half])


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
      // De cara a la derecha para lanzar: la posición de la mano está medida
      // sobre la hoja sin voltear, y con el personaje girado la perla saldría
      // del lado contrario al que la dibuja.
      facingRef.current = 1
      if (spriteRef.current) spriteRef.current.style.transform = ''
      teleportingRef.current = true
      stateRef.current = 'throw'
      setCharacterState('throw')

      // La perla sale de la mano en el frame de máxima extensión, no del
      // centro del personaje: la geometría de la hoja dice dónde está.
      const sheet = SHEET_GEOMETRY.throw
      const scale = charHeight / sheet.charHeight
      const cellBottom = feetVhRef.current * window.innerHeight - (600 - sheet.footY) * scale
      const cellTopY = window.innerHeight - cellBottom - 600 * scale
      const handX =
        window.innerWidth * (actorXRef.current / 100) + (THROW_RELEASE.handX - sheet.centerX) * scale
      const handY = cellTopY + THROW_RELEASE.handY * scale

      setShot({
        fromX: handX,
        fromY: handY,
        // Aterriza exactamente donde el personaje se planta: mismo eje, mismos pies.
        toX: window.innerWidth * (actorXRef.current / 100),
        toY: window.innerHeight - feetVhRef.current * worldPx,
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
    [jumpTo, landingFor, charHeight, worldPx],
  )

  const handleGreetingEnd = useCallback(() => setPhase('entering'), [])

  const sky = skyAt(night)
  const filled = Math.round(progress * BAR_CELLS)
  const titleClass = started ? styles.titlesOut : phase === 'ready' ? styles.titlesIn : ''
  const tileWidth = (worldPx || 1080) * LAYER_ASPECT
  /** Cada capa conserva su alto propio: se recortaron por arriba hasta donde
   *  empieza su contenido, así que la de los árboles sobresale de la caja del
   *  mundo y la del suelo pelado no arrastra cielo vacío. */
  const heightOf = (name: string) => ((worldPx || 1080) * (LAYER_HEIGHT[name] ?? WORLD_UNIT)) / WORLD_UNIT
  /**
   * Bordes del territorio de un bioma, en píxeles del contenedor de su capa.
   *
   * Lleva el término `-worldX*(1-speed)` para que la frontera caiga en la
   * MISMA x de pantalla en todas las capas. Sin él, cada capa cortaba el bioma
   * en un sitio distinto —el fondo mucho antes que el suelo— y se veía taiga
   * detrás de bosque. La frontera es una línea vertical que se cruza andando,
   * y detrás de ella el parallax sigue funcionando con normalidad.
   */
  const spanOf = (i: number, speed: number) => ({
    spanFrom: BOUNDS[i].from === -Infinity ? -Infinity : BOUNDS[i].from * WORLD_LENGTH,
    spanTo: BOUNDS[i].to === Infinity ? Infinity : BOUNDS[i].to * WORLD_LENGTH,
    shift: worldAtRef.current * WORLD_LENGTH * (1 - speed),
  })
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
      ref={rootRef}
      className={styles.page}
      style={
        {
          height: pageHeight,
          '--char-feet': `${feetVhRef.current * worldPx}px`,
          '--world-h': `${worldPx}px`,
          // El terreno se apaga y se enfría con la noche. Así el mismo render
          // sirve para cualquier hora sin volver a pasarlo por Mine-imator.
          '--world-grade': `brightness(${1.1 - night * 0.62}) contrast(${1.08 - night * 0.1}) saturate(${1.06 - night * 0.5}) hue-rotate(${night * 12}deg)`,
          // Los comparten el cielo y la niebla de las capas.
          '--sky-top': sky.top,
          '--sky-mid': sky.mid,
          '--sky-bottom': sky.bottom,
        } as React.CSSProperties
      }
    >
      {/* Primer elemento enfocable de la página. Quien llegue con teclado o
          lector de pantalla se topa con un mundo de canvas sin contenido; esto
          es la salida, y tiene que estar antes que los cinco botones de la
          barra en vez de enterrada detrás de ellos. */}
      <Link href="/simple" className={styles.skip}>
        Ir a la versión en texto, sin animaciones
      </Link>

      {/* La página nunca navega, así que cambiar de sección era silencioso. */}
      <p className={styles.announce} aria-live="polite">
        {SECTIONS.find((section) => section.id === active)?.label ?? ''}
      </p>

      <div className={styles.stage}>
        <NightSky night={night} />

        {(['far', 'mid', 'near'] as Kind[]).map((kind) => (
          <Fragment key={kind}>
          <div
            ref={kind === 'far' ? farRef : kind === 'mid' ? midRef : nearRef}
            className={`${layerStyles.box} ${styles[kind]}`}
          >
            {mounted
              .filter((i) => (SECTIONS[i].kinds as readonly string[]).includes(kind))
              .map((i) => SECTIONS[i])
              .map((s) => (
              <Strip
                key={s.biome}
                src={`/layers/${s.biome}_${kind}.webp`}
                travel={WORLD_LENGTH * LAYER_SPEED[kind]}
                tileWidth={tileWidth}
                tileHeight={heightOf(`${s.biome}_${kind}`)}
                speed={LAYER_SPEED[kind]}
                viewport={viewW}
                {...spanOf(SECTIONS.indexOf(s), LAYER_SPEED[kind])}
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
          {/* Niebla de distancia y tinte de tormenta, entre esta capa y la
              siguiente. Cada uno con su fuerza y sus biomas. */}
          <div
            className={`${styles.scrim} ${
              kind === 'far' ? styles.fogFar : kind === 'mid' ? styles.fogMid : styles.fogNear
            }`}
            aria-hidden="true"
          />
          <div
            className={`${styles.scrim} ${
              kind === 'far' ? styles.sandFar : kind === 'mid' ? styles.sandMid : styles.sandNear
            }`}
            aria-hidden="true"
          />
          </Fragment>
        ))}

        {phase === 'entering' || phase === 'ready' ? (
          <div
            ref={actorRef}
            className={`${styles.actor} ${hidden ? styles.actorGone : ''}`}
            style={{ left: phase === 'entering' ? `${ENTRY_FROM}%` : `${actorXRef.current}%` }}
          >
            <Character
              state={characterState}
              charHeight={charHeight}
              driven={characterState !== 'idle'}
              spriteRef={spriteRef}
            />
          </div>
        ) : null}

        <div ref={groundRef} className={`${layerStyles.box} ${styles.ground}`}>
          {mounted.map((i) => SECTIONS[i]).map((s) => (
            <Strip
              key={s.biome}
              src={`/layers/${s.biome}_ground.webp`}
              travel={WORLD_LENGTH}
              tileWidth={tileWidth}
              tileHeight={heightOf(`${s.biome}_ground`)}
              speed={LAYER_SPEED.ground}
              viewport={viewW}
              {...spanOf(SECTIONS.indexOf(s), LAYER_SPEED.ground)}
              half={half}
              extend={s.biome === 'b5' ? 2 : 0}
              anchor={s.biome === 'b5' ? cliffAnchor : undefined}
            />
          ))}
        </div>

        <Inventory title="Proyectos" projects={PROJECTS} openness={chestOpen} />
        <Book
          title="Sobre mí"
          pages={ABOUT_PAGES}
          portrait={{ src: '/avatar.png', alt: 'Vicente Araya' }}
          openness={bookOpen}
        />
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

        <Weather stateRef={weatherRef} worldDeltaRef={worldDeltaRef} />

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
            <Link
              href="/simple"
              className={`${styles.navButton} ${reduced ? styles.navQuiet : ''}`}
            >
              Versión en texto
            </Link>
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
