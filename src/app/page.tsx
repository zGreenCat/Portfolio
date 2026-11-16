'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import Character, {
  CELL_WIDTH,
  FRAME_COUNT,
  SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from '@/components/Character'
import { CELL_HEIGHT, STATES, sheetSrc, wantsHalfSheet } from '@/components/characterSheets'
import EnderPearl, { type PearlThrow } from '@/components/EnderPearl'
import Book from '@/components/Book'
import CraftingTable from '@/components/CraftingTable'
import Inventory from '@/components/Inventory'
import PerfMeter from '@/components/PerfMeter'
import Podium, { PodiumMedal } from '@/components/Podium'
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
const PEEK = { cellWidth: 960, cellHeight: 570, columns: 8, rows: 4, frames: 32, fps: 18 }
/** El saludo pesa lo suyo descomprimido —70 MB entero— y va en la carga que
 *  bloquea la pantalla, así que en pantallas pequeñas se sirve a la mitad. La
 *  celda se declara igual en los dos casos: el fondo se escala al tamaño pedido. */
const peekSrc = (half: boolean) => `/sprites/peek_wave${half ? '@half' : ''}.webp`

/** Alto de página dedicado al recorrido. */
const SCROLL_LENGTH = 7000

/**
 * La ÚNICA correspondencia entre scroll y mundo. Estaba repetida en seis
 * sitios; tenerla aquí es lo que permite moverla sin que alguno se quede atrás.
 */
const worldFromScroll = (y: number) => Math.min(1, Math.max(0, y / SCROLL_LENGTH))
const scrollFromWorld = (at: number) => at * SCROLL_LENGTH
/** Píxeles de mundo que recorre la capa del suelo de punta a punta. */
const WORLD_LENGTH = 12000
/** El ancho de una tesela, en unidades de la caja del mundo. */
const LAYER_ASPECT = 3840 / WORLD_UNIT
/** Bloques que avanza cada ciclo. Caminar cubre menos suelo por zancada, así
 *  que su ciclo tiene que ir más apretado o los pies patinan. */
const STRIDE: Record<CharacterState, number> = {
  run: 2.1,
  walk: 1.25,
  idle: 1,
  throw: 1,
  sit: 1,
  climb: 1,
  cheer: 1,
}
/** Umbrales de marcha, en bloques por segundo. `walk` cubre 1,25 bloques en
 *  25 frames: por encima de ~2 b/s su ciclo se dispara, así que ahí ya corre. */
const SPEED_RUN = 2.2
const SPEED_WALK = 0.45
/** Para dejar de correr hay que bajar bastante más de lo que costó arrancar.
 *  Con un solo umbral, frenando cerca de él la marcha cambiaba en cada frame:
 *  correr, caminar, correr. */
const SPEED_RUN_OFF = 1.4
/** La marcha se elige con la velocidad suavizada, no con la del frame, y
 *  suavizada despacio. Un golpe de rueda son más de 13 bloques por segundo
 *  que se apagan en un cuarto de segundo: con la del frame, cada golpe era
 *  correr, caminar y parar. Así varios golpes seguidos son correr, que es lo
 *  que dice su media. */
const PACE_SECONDS = 0.55
/** Cadencia mínima de cada marcha, en zancadas por segundo. La zancada sale
 *  de la distancia recorrida, y frenando esa distancia se acaba antes que la
 *  marcha: se quedaba un cuarto de segundo clavado en una pose de correr. Con
 *  un mínimo termina el paso en vez de congelarse. Queda por debajo de lo que
 *  cada marcha da a su velocidad más baja, así que solo actúa al frenar. */
const MIN_CADENCE: Partial<Record<CharacterState, number>> = { run: 1, walk: 0.5 }
/** Lo que una marcha se mantiene antes de poder cambiar a la otra. */
const GAIT_HOLD_SECONDS = 0.25
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
/** Tiempo seguido por debajo del umbral antes de pasar a reposo. Corto: en
 *  esa espera la zancada no avanza, y con 0,3 s se quedaba clavado en la pose
 *  de correr al frenar. No hace falta más para la rueda: un golpe tarda unos
 *  300 ms en apagarse, así que golpes seguidos no llegan a esta espera.
 *
 *  En segundos, como todo lo de la marcha. Estuvo en frames, y en un monitor
 *  de 120 Hz valía la mitad. */
const IDLE_SECONDS = 0.1
/** Lado de la perla respecto al alto del personaje: los 32 px que medía en un
 *  escritorio normal, hechos proporción. */
const PEARL_OF_CHARACTER = 0.176
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
/** Por debajo de este ancho el saludo va a mitad de resolución, y las capas
 *  también, sin mirar nada más. */
const HALF_RES_WIDTH = 900
/** Ancho de una capa a media resolución, en sus propios píxeles. */
const HALF_LAYER_PX = 1920
/**
 * Las capas enteras (3840 px) solo se usan si la tesela ocupa en pantalla, en
 * píxeles físicos, más de esto veces la media. Por debajo se sirve la media.
 *
 * Antes mandaba solo el ancho de la ventana, y un portátil de 1080p al 125%
 * —982 px de ancho, tesela de 2.600 px físicos— cargaba las de 3840 para
 * encogerlas en cada frame: 36–45 fps en una gráfica integrada, con hasta
 * quince a la vez en las fronteras. Con la media, 60. La media se amplía como
 * mucho este factor, y el mundo son bloques: no se nota como en una foto.
 */
const FULL_RES_FROM = 1.7

/** ¿Tocan las hojas del personaje a la mitad en esta ventana? */
function wantsHalfSprites(): boolean {
  const portrait = window.innerHeight > window.innerWidth
  const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
  const cell = world * CHAR_HEIGHT_VH * (CELL_HEIGHT / SHEET_GEOMETRY.idle.charHeight)
  return wantsHalfSheet(cell * window.devicePixelRatio)
}

/** ¿Tocan las capas a media resolución en esta ventana? */
function wantsHalfLayers(): boolean {
  if (window.innerWidth < HALF_RES_WIDTH) return true
  const portrait = window.innerHeight > window.innerWidth
  const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
  return world * LAYER_ASPECT * window.devicePixelRatio < HALF_LAYER_PX * FULL_RES_FROM
}
/** Sale por el borde de abajo y ocupa media pantalla de alto. En vertical eso
 *  lo haría más ancho que la pantalla y los brazos se cortarían por los lados,
 *  así que el ancho también pone tope. */
const PEEK_CELL_VH = 0.5
const PEEK_CELL_VW = 0.96

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
  // El templo del desierto no se tesela: es un edificio, y los edificios no
  // se repiten cada 300 metros. Va anclado a la sección.
  {
    id: 'sobre-mi',
    label: 'Sobre mí',
    at: 0.24,
    biome: 'b3',
    surfaceY: 2716,
    kinds: ALL_KINDS,
    anchored: ['far'] as readonly string[],
    fog: true,
    weather: 'sand' as WeatherKind,
  },
  // Proyectos y hackatones comparten lugar: el cofre y, un poco antes, el
  // escenario del podio. El `id` sigue siendo `proyectos` para no romper los
  // enlaces que ya circulan; lo que cambió es el rótulo.
  {
    id: 'proyectos',
    label: 'Experiencias',
    at: 0.52,
    biome: 'b2',
    surfaceY: 2705,
    kinds: ALL_KINDS,
    fog: true,
    weather: 'snow' as WeatherKind,
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

/** Posición de una sección por su `id`. Los paneles la buscaban por su puesto
 *  en la lista, y eso se rompe en cuanto se inserta o se reordena una. */
const atOf = (id: (typeof SECTIONS)[number]['id']) =>
  SECTIONS.find((section) => section.id === id)?.at ?? 0

/*
 * El podio. Va en la taiga, justo después del cofre, y es lo segundo del
 * recorrido que NO es una posición: como sentarse, es un gesto que corre por
 * tiempo y no escucha la rueda hasta que termina. A diferencia de sentarse, no
 * se dispara solo: se pide con un botón.
 */
/** Dónde se planta para subir. El escenario mide dieciséis bloques y crece
 *  con el alto de la pantalla, mientras que el bioma mide lo mismo en píxeles:
 *  más adelante que esto, en un monitor de 1440 se salía por la frontera con
 *  los cerezos. */
const PODIUM_AT = 0.46
/** Hueco entre el cofre y el peldaño del estrado, en px del render. Ahí se
 *  planta el personaje: con el cofre a su espalda y el escenario delante. */
const CHEST_GAP = 190
/** Ancho del cofre en px del render: 14 de los 16 píxeles de un bloque, como
 *  en el juego. Lo imprime `scripts/render/chest.py`. */
const CHEST_PX = 124
/** La medalla que flota a la entrada del escenario, en px del render. */
const MEDAL = { width: 88, up: 240 } as const
/** Holgura para dar por llegado al personaje después de pedirlo. Tiene que
 *  ser de píxeles: el mundo se clava donde está al empezar a subir, y lo que
 *  falte por andar es lo que flotaría fuera de la columna. */
const PODIUM_ZONE = 0.0006
/** Pedirlo desde más cerca que esto no es una caminata: no hay recorrido con
 *  el que acompasar el encuadre. */
const PODIUM_NEAR = 0.005
/** Si la rueda se mueve esto mientras va de camino, es que ya no quiere ir. */
const PODIUM_CANCEL = 0.002
/** Y alejarse de verdad para que baje, igual que con `SIT_RELEASE`. */
const PODIUM_RELEASE = 0.035
/** Lo que dura subir: 32 frames de la hoja `climb`. */
const PODIUM_SECONDS = 1.6
/** En el podio el personaje se va a la izquierda. El escenario queda a su
 *  derecha y el cajón ocupa el otro 42%: al 20% el primer puesto caía bajo el
 *  velo del cajón. */
const PODIUM_X = 7
/**
 * Puntos de apoyo del escenario, en píxeles del render. Los imprime
 * `scripts/render/world.py` (ANCHOR) al renderizar `podium_stage`; si cambia
 * la escena hay que volver a copiarlos. `x` cuenta desde donde se planta en el
 * estrado, `up` desde la línea de los pies en el suelo.
 */
const STAGE = {
  /** Columna del render donde se planta, sobre la alfombra. */
  anchorX: 1287.1,
  /** El estrado: de su peldaño izquierdo a su extremo derecho. */
  from: -274.8,
  to: 1688,
  /** Lo que levanta el estrado: media losa, vista por la cámara. */
  lift: 67.6,
  second: { x: 314.1, up: 353.9 },
  first: { x: 706.7, up: 484.8 },
  /** La bajada hacia delante: el tercer puesto y la alfombra del otro lado. */
  third: { x: 1099.3, up: 288.5 },
  exit: { x: 1413.4, up: 67.6 },
} as const
/** Los dos saltos de `climb`: frames en el aire y altura del arco, en px del
 *  render. Los frames salen de `HOPS` en `scripts/render/gen_podium.py`. */
const PODIUM_HOPS = [
  { from: 4, to: 10, arc: 92 },
  { from: 13, to: 19, arc: 88 },
] as const
/** Frame de `climb` en el que ya ha caído y empieza a girarse (`LANDED`). */
const PODIUM_LANDED = 20

type Spot = { x: number; up: number }
const PODIUM_WAY_UP: readonly Spot[] = [{ x: 0, up: STAGE.lift }, STAGE.second, STAGE.first]
const PODIUM_WAY_DOWN: readonly Spot[] = [STAGE.first, STAGE.third, STAGE.exit]

/** Dónde está respecto a su sitio en el estrado, en el frame `frame` de los
 *  saltos, yendo de parada en parada. */
function hopSpot(frame: number, stops: readonly Spot[]): Spot {
  for (let i = 0; i < PODIUM_HOPS.length; i += 1) {
    const hop = PODIUM_HOPS[i]
    if (frame <= hop.from) return stops[i]
    if (frame < hop.to) {
      const u = (frame - hop.from) / (hop.to - hop.from)
      return {
        x: stops[i].x + (stops[i + 1].x - stops[i].x) * u,
        up: stops[i].up + (stops[i + 1].up - stops[i].up) * u + hop.arc * 4 * u * (1 - u),
      }
    }
  }
  return stops[stops.length - 1]
}

/**
 * Frame de `climb` y sitio en el estrado para un punto `at` del gesto (0→1).
 *
 * Subir y bajar de vuelta son la misma hoja en un sentido y en el otro. Bajar
 * hacia delante no: se gira de nuevo de perfil —el final de la hoja al revés—
 * y luego da los mismos dos saltos hacia delante, ahora al tercer puesto y al
 * suelo. Rebobinar ahí lo devolvía al lado por el que vino justo cuando se iba
 * por el otro.
 */
function podiumPose(at: number, leavingAhead: boolean): { frame: number; spot: Spot } {
  const last = FRAME_COUNT.climb - 1
  if (!leavingAhead) {
    const frame = at * FRAME_COUNT.climb
    return { frame: Math.min(last, Math.floor(frame)), spot: hopSpot(frame, PODIUM_WAY_UP) }
  }
  const elapsed = (1 - at) * FRAME_COUNT.climb
  const turn = FRAME_COUNT.climb - PODIUM_LANDED
  if (elapsed < turn) return { frame: last - Math.floor(elapsed), spot: STAGE.first }
  const frame = elapsed - turn
  return {
    frame: Math.min(PODIUM_LANDED - 1, Math.floor(frame)),
    spot: hopSpot(frame, PODIUM_WAY_DOWN),
  }
}

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

/**
 * Modo ligero: se enciende solo cuando la máquina no da.
 *
 * El caso que lo motiva es la aceleración por hardware desactivada. Con GPU el
 * `filter` de las capas se aplica una vez sobre una textura y moverla sale
 * gratis; sin ella, el navegador repinta ~43 Mpx filtrados en cada frame sobre
 * la CPU y el recorrido se arrastra.
 *
 * Se mide el tiempo real de frame, no las capacidades del navegador: no hay
 * forma fiable de preguntar si la GPU está activa, y el síntoma es lo que
 * importa. Solo cuentan los frames en los que el mundo se mueve — parado, un
 * frame lento no significa nada.
 */
const LITE_SAMPLE = 120
/** 40 fps de media. Estuvo en 33 ms —30 fps—, y un equipo a 35–45 iba a
 *  tirones sin que saltara nunca. */
const LITE_MS = 25

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
  /** Lo mismo para las hojas del personaje, que se deciden aparte: dependen
   *  de lo que mide él en pantalla, no la tesela. */
  const [spriteHalf, setSpriteHalf] = useState(false)
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
  /** Lo mismo que `sitRef`, `sitWantRef` y `sitDirRef`, para subir al podio. */
  const podiumRef = useRef(0)
  const podiumWantRef = useRef(false)
  const podiumDirRef = useRef(-1)
  /** Posición del mundo en la que el personaje queda junto al cofre. No es una
   *  constante: el escenario crece con el alto de la pantalla y el cofre con
   *  el ancho, así que su sitio depende de las dos cosas. */
  const chestAtRef = useRef(PODIUM_AT - 0.045)
  /** Se pidió subir y aún no ha llegado. Lo pone el botón, lo consume el bucle. */
  const podiumAskRef = useRef(false)
  /** Baja hacia delante, por el tercer puesto, en vez de por donde subió. */
  const podiumAheadRef = useRef(false)
  /** Tocó suelo al otro lado: la posición del mundo que le corresponde ahí,
   *  mientras el mundo no haya llegado hasta ella. */
  const podiumLandRef = useRef<number | null>(null)
  /** Desde dónde echó a andar hacia el podio. */
  const podiumFromRef = useRef(PODIUM_AT)
  /** Cuánto se ha corrido a la izquierda para dejarle sitio al escenario. */
  const podiumFocusRef = useRef(0)
  const [podiumOpen, setPodiumOpen] = useState(0)
  /** Frames lentos acumulados con el mundo en marcha. */
  const slowRef = useRef({ frames: 0, total: 0 })
  const [lite, setLite] = useState(false)
  /** `?lite=0`: el modo ligero no se enciende solo. Para comparar. */
  const liteLockRef = useRef(false)
  /** `?fps`: enseña el medidor. */
  const [meter, setMeter] = useState(false)

  // Diagnóstico por URL. `?fps` enseña el medidor; `?lite=1` fuerza el modo
  // ligero y `?lite=0` lo prohíbe, para ver en el equipo real cuánto pesa.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.has('fps')) setMeter(true)
    if (query.get('lite') === '1') setLite(true)
    if (query.get('lite') === '0') liteLockRef.current = true
  }, [])
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
  const propsRef = useRef<HTMLDivElement>(null)
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
    if ((characterState === 'idle' || characterState === 'cheer') && spriteRef.current) {
      spriteRef.current.style.backgroundPositionX = ''
    }
  }, [characterState])

  // --- gesto de lanzamiento ---
  // El primer frame se escribe al montar la hoja, antes de pintar. Lanzando en
  // marcha, el nodo traía el desplazamiento de la zancada, y sobre la hoja de
  // lanzar eso era una pose de mitad del gesto durante un frame.
  useLayoutEffect(() => {
    if (characterState === 'throw') writeFrame(0)
  }, [characterState, writeFrame])

  useEffect(() => {
    if (characterState !== 'throw') return
    const t0 = performance.now()
    let raf = 0
    let released = false
    const step = (now: number) => {
      // Nunca negativo: la marca del frame puede ser anterior al momento en
      // que arrancó el efecto, y un tiempo negativo daba el frame -1, que al
      // envolver es el último del gesto. Era el parpadeo al empezar a lanzar.
      const t = Math.max(0, (now - t0) / THROW_MS)
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
    const progress = worldFromScroll(window.scrollY)
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
    // El cofre de Experiencias no está en el `at` de la sección: va delante del
    // escenario, y ahí es donde se abre su cajón.
    if (section.id === 'proyectos') return chestAtRef.current
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
    window.scrollTo({ top: scrollFromWorld(at), behavior: 'auto' })
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

    // Todo se pide ya en el tamaño que se va a enseñar: aquí aún no hay
    // estado `half`, así que se mira la ventana directamente. Las capas del
    // primer bioma se pedían siempre enteras, y quien iba a ver las medias
    // bajaba las dos.
    const halfLayers = wantsHalfLayers()
    const halfSprites = wantsHalfSprites()
    const wanted = [
      peekSrc(window.innerWidth < HALF_RES_WIDTH),
      ...PRELOAD.map((src) =>
        (src.startsWith('/layers/') ? halfLayers : halfSprites)
          ? src.replace('.webp', '@half.webp')
          : src,
      ),
    ]
    wanted.forEach((src) => {
      void preload(src).then(() => {
        done += 1
        if (!cancelled) setProgress(done / wanted.length)
        if (done === wanted.length) enter()
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
      setHalf(wantsHalfLayers())
      setSpriteHalf(wantsHalfSprites())
      BOUNDS = makeBounds(window.innerWidth)
      setCompact(window.innerWidth <= 760)
      setCharHeight(world * CHAR_HEIGHT_VH)
      setPeekScale(
        Math.min(
          (window.innerHeight * PEEK_CELL_VH) / PEEK.cellHeight,
          (window.innerWidth * PEEK_CELL_VW) / PEEK.cellWidth,
        ),
      )
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
        [propsRef.current, LAYER_SPEED.ground],
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
      if (next !== 'idle' && next !== 'cheer' && spriteRef.current) {
        spriteRef.current.dataset.driven = 'true'
      }
      setCharacterState(next)
    }

    const read = () => {
      target = worldFromScroll(window.scrollY)
    }

    const block = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT)
    let previous = 0
    let last = performance.now()
    /** Por dónde va la zancada, en ciclos. En ciclos y no en frames porque
     *  `run` y `walk` no tienen los mismos: el frame 12 es media zancada en
     *  una hoja y tres cuartos en la otra, y al cambiar de marcha el paso
     *  daba un salto. */
    let cycle = 0
    let pace = 0
    let gaitHeld = GAIT_HOLD_SECONDS

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (podiumLandRef.current !== null) {
        // Bajó por el otro lado del podio y el mundo sigue clavado donde subió.
        // No se recoloca de golpe —sería un corte de cámara—: él se queda donde
        // cayó y el mundo avanza hasta alcanzarlo. Mientras, la rueda no puede
        // quedarse más atrás, o no lo alcanzaría nunca.
        if (current >= podiumLandRef.current - 0.00003) {
          podiumLandRef.current = null
          podiumFocusRef.current = 0
        } else if (target < podiumLandRef.current) {
          target = podiumLandRef.current
        }
      }
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
        podiumRef.current = 0
        podiumDirRef.current = -1
        podiumWantRef.current = false
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
      if (sitRef.current > 0 || podiumRef.current > 0) {
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

      // Vigilante de rendimiento. Solo mide con el mundo en marcha.
      if (!lite && Math.abs(travelled) > 0.5) {
        const sample = slowRef.current
        sample.frames += 1
        sample.total += dt * 1000
        if (sample.frames >= LITE_SAMPLE) {
          if (!liteLockRef.current && sample.total / sample.frames > LITE_MS) setLite(true)
          sample.frames = 0
          sample.total = 0
        }
      }
      worldDeltaRef.current = travelled
      const speed = dt > 0 ? Math.abs(travelled) / dt / block : 0
      previous = worldX
      pace += (speed - pace) * (1 - Math.exp(-dt / PACE_SECONDS))
      if (speed <= SPEED_WALK) stillFor += dt
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

      // Subir al podio sigue la misma regla, con una diferencia: no se dispara
      // por llegar, se pide. Hubo una versión que subía al detenerse delante, y
      // la zona eran 84 px de scroll: con la perla se acertaba siempre y con
      // la rueda casi nunca, así que una vez abajo no había forma de volver.
      const fromPodium = Math.abs(target - PODIUM_AT)
      if (fromPodium > PODIUM_RELEASE) podiumWantRef.current = false
      if (fromPodium > PODIUM_CANCEL) podiumAskRef.current = false
      else if (
        podiumAskRef.current &&
        Math.abs(current - PODIUM_AT) < PODIUM_ZONE &&
        podiumFocusRef.current > 0.97
      ) {
        // Llegó andando. El mundo se clava en el sitio exacto, no donde lo
        // dejó el suavizado: de eso depende que caiga sobre la columna.
        podiumAskRef.current = false
        podiumWantRef.current = true
        sitLockRef.current = PODIUM_AT
      }
      if (podiumRef.current === 0 || podiumRef.current === 1) {
        podiumDirRef.current = podiumWantRef.current ? 1 : -1
        // Por dónde baja se decide arriba y no se cambia a medio salto.
        podiumAheadRef.current = podiumRef.current === 1 && target > PODIUM_AT
      }
      const wasUp = podiumRef.current > 0
      podiumRef.current = Math.min(
        1,
        Math.max(0, podiumRef.current + (podiumDirRef.current * dt) / PODIUM_SECONDS),
      )
      const podiumAt = podiumRef.current
      const leavingAhead = podiumDirRef.current < 0 && podiumAheadRef.current
      if (wasUp && podiumAt === 0 && leavingAhead) {
        podiumLandRef.current =
          PODIUM_AT +
          ((STAGE.exit.x * worldPx) / WORLD_UNIT -
            (window.innerWidth * (ENTRY_TO - PODIUM_X)) / 100) /
            WORLD_LENGTH
        if (target < podiumLandRef.current) {
          window.scrollTo({ top: scrollFromWorld(podiumLandRef.current), behavior: 'auto' })
        }
      }
      const landed = podiumLandRef.current !== null
      const podiumNow = podiumPose(podiumAt, leavingAhead)
      const gesturing = sitAt > 0 || podiumAt > 0

      if (!teleportingRef.current) {
        // El retardo se cuenta en frames, no con un temporizador: dentro del
        // bucle, un setTimeout se reiniciaba en cada vuelta y no llegaba a
        // cumplirse nunca, así que se quedaba caminando para siempre.
        if (sitAt > 0) applyState('sit')
        else if (podiumAt >= 1) applyState('cheer')
        else if (podiumAt > 0) applyState('climb')
        // Quieto mientras la cámara lo alcanza: el mundo corre, pero él no.
        else if (landed) applyState('idle')
        else if (stillFor >= IDLE_SECONDS) {
          applyState('idle')
          gaitHeld = GAIT_HOLD_SECONDS
        } else if (speed > SPEED_WALK) {
          // Desde parado se arranca en la marcha que toque. En marcha, solo
          // se cambia pasado el margen y con la anterior ya asentada. Y para
          // echar a correr tiene que seguir yendo rápido ahora mismo: tras un
          // golpe suelto la media sigue alta cuando el mundo ya está frenando,
          // y arrancaba a correr para pararse al instante.
          const moving = stateRef.current === 'run' || stateRef.current === 'walk'
          const running = stateRef.current === 'run'
          const wantsRun = running
            ? pace > SPEED_RUN_OFF
            : pace > SPEED_RUN && speed > SPEED_RUN
          if (!moving) {
            applyState(pace > SPEED_RUN ? 'run' : 'walk')
            gaitHeld = 0
          } else if (wantsRun !== running && gaitHeld >= GAIT_HOLD_SECONDS) {
            applyState(wantsRun ? 'run' : 'walk')
            gaitHeld = 0
          }
        }
      }
      gaitHeld += dt

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
      const floor = (MIN_CADENCE[active] ?? 0) * dt
      cycle = (cycle + Math.max(floor, Math.min(cap, wanted) / FRAME_COUNT[active])) % 1
      if (active === 'sit') {
        // El frame lo marca la posición, no la distancia recorrida: el gesto
        // tiene principio y final, no es un ciclo.
        writeFrame(Math.min(FRAME_COUNT.sit - 1, Math.floor(sitAt * FRAME_COUNT.sit)))
      } else if (active === 'climb') {
        writeFrame(podiumNow.frame)
      } else if (active !== 'idle' && active !== 'cheer' && active !== 'throw') {
        // En reposo manda el bucle CSS: escribirle el frame lo dejaría clavado.
        // El lanzamiento lleva su propio reloj: escribirle aquí el frame de la
        // zancada, que parado no avanza, lo pisaba y el gesto no se movía.
        // El frame se cuenta sobre la hoja que el nodo enseña, que durante un
        // frame aún es la de la marcha anterior.
        const shown = spriteRef.current?.dataset.state
        const sheet = shown === 'run' || shown === 'walk' ? shown : active
        writeFrame(Math.floor(cycle * FRAME_COUNT[sheet]))
      }

      // Retroceder es darse la vuelta, no rebobinar. La banda muerta evita que
      // un temblor de rueda lo haga girar sobre sí mismo. Sentado no se gira:
      // la hoja está dibujada mirando al vacío y voltearla lo pondría de
      // espaldas al horizonte mientras se levanta.
      if (podiumAt > 0 && facingRef.current < 0) {
        // Al podio se sube de frente al escenario, aunque se llegara de vuelta.
        facingRef.current = 1
        if (spriteRef.current) spriteRef.current.style.transform = ''
      }
      if (!teleportingRef.current && !gesturing && Math.abs(travelled) > 0.6) {
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
      // Y se cierra a la izquierda mientras está en el podio, para dejarle sitio
      // al escenario. Solo entonces: atado a la posición, quien cruzaba andando
      // veía al personaje frenar y acelerar en mitad del bioma. De camino se
      // corre al paso de lo que anda, y los dos acaban a la vez: por su cuenta
      // patinaba de lado con el mundo ya quieto. Al bajar vuelve poco a poco.
      const focused = podiumAskRef.current || podiumAt > 0 || podiumLandRef.current !== null
      const walkIn = Math.abs(podiumFromRef.current - PODIUM_AT)
      if (podiumAskRef.current && walkIn > PODIUM_NEAR) {
        podiumFocusRef.current = Math.max(
          podiumFocusRef.current,
          1 - Math.min(1, Math.abs(current - PODIUM_AT) / walkIn),
        )
      } else {
        podiumFocusRef.current += ((focused ? 1 : 0) - podiumFocusRef.current) * 0.1
        if (Math.abs(podiumFocusRef.current - (focused ? 1 : 0)) < 0.002) {
          podiumFocusRef.current = focused ? 1 : 0
        }
      }
      const wantX =
        ENTRY_TO + (CLIFF_X - ENTRY_TO) * toCliff + (PODIUM_X - ENTRY_TO) * podiumFocusRef.current
      actorXRef.current = wantX
      if (actorRef.current) {
        actorRef.current.style.left = `${wantX}%`
        // Lo que lo separa de la línea del suelo: el estrado bajo sus pies al
        // cruzarlo andando, y los saltos mientras sube.
        const scale = worldPx / WORLD_UNIT
        const onStage =
          ((window.innerWidth * (wantX - PODIUM_X)) / 100 + worldX - PODIUM_AT * WORLD_LENGTH) / scale
        const edge = Math.min(onStage - STAGE.from, STAGE.to - onStage)
        const walking = { x: 0, up: STAGE.lift * Math.min(1, Math.max(0, edge / 24)) }
        // Tras bajar por el otro lado sigue donde cayó, y lo que avanza el
        // mundo se le descuenta hasta que lo alcanza.
        const spot =
          podiumAt > 0
            ? podiumNow.spot
            : landed
              ? { x: STAGE.exit.x - (worldX - PODIUM_AT * WORLD_LENGTH) / scale, up: STAGE.exit.up }
              : walking
        actorRef.current.style.transform = `translate3d(${spot.x * scale}px,${-spot.up * scale}px,0)`
      }

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
      // El cajón del podio es la excepción: lo abre el gesto, no la distancia,
      // y mientras está abierto cierra el del cofre, que queda a un paso.
      const onPodium = quantize(podiumAt, PANEL_STEPS)
      setPodiumOpen(onPodium)
      setChestOpen(
        quantize(panelOpenness(chestAtRef.current, current) * (1 - podiumAt), PANEL_STEPS),
      )
      setBookOpen(quantize(panelOpenness(atOf('sobre-mi'), current), PANEL_STEPS))
      setSignsOpen(quantize(panelOpenness(atOf('contacto'), current), PANEL_STEPS))
      setBenchOpen(quantize(panelOpenness(atOf('skills'), current), PANEL_STEPS))
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
      window.scrollTo({ top: scrollFromWorld(target), behavior: 'auto' })
    }

    current = target
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [phase, worldPx, half, lite, writeFrame, placeWorld])


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
      ...STATES.map((state) => sheetSrc(state, spriteHalf)),
      layerSrc('b2', 'stage', half),
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
  }, [phase, half, spriteHalf])

  const jumpTo = useCallback((at: number, id: string) => {
    snapRef.current = true
    window.scrollTo({ top: scrollFromWorld(at), behavior: 'auto' })
    window.history.replaceState(null, '', `#${id}`)
    setActive(id)
  }, [])

  /** Lanza una perla y reaparece en `at`. */
  const pearlTo = useCallback(
    (at: number, id: string) => {
      // Segundo clic durante el vuelo: al destino y punto. Nadie espera dos veces.
      if (teleportingRef.current) {
        setShot(null)
        teleportingRef.current = false
        setHidden(false)
        jumpTo(at, id)
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
      //
      // La celda se mide en pantalla, no se deduce. Deducida —20% del ancho,
      // pies en la línea del suelo— no sabía nada de lo que desplaza al
      // personaje: en el podio la perla salía del suelo, a un lado, y en
      // vertical el alto del mundo no es el de la ventana. Todas las hojas de
      // perfil comparten celda, así que la que haya ahora vale.
      const cell = spriteRef.current?.getBoundingClientRect()
      const sheet = SHEET_GEOMETRY.throw
      const scale = cell ? cell.width / CELL_WIDTH : charHeight / sheet.charHeight
      const cellLeft = cell
        ? cell.left
        : window.innerWidth * (actorXRef.current / 100) - sheet.centerX * scale
      const cellTop = cell
        ? cell.top
        : window.innerHeight - feetVhRef.current * worldPx - sheet.footY * scale
      const handX = cellLeft + THROW_RELEASE.handX * scale
      const handY = cellTop + THROW_RELEASE.handY * scale

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
          jumpTo(at, id)
        },
        // La perla espera a que la mano llegue al frame de suelta.
        delayMs: (THROW_RELEASE.frame / FRAME_COUNT.throw) * THROW_MS,
        size: Math.max(16, Math.round(charHeight * PEARL_OF_CHARACTER)),
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
    [jumpTo, charHeight, worldPx],
  )

  const navigate = useCallback(
    (section: (typeof SECTIONS)[number]) =>
      pearlTo(landingFor(SECTIONS.indexOf(section)), section.id),
    [pearlTo, landingFor],
  )

  /** Al podio se va andando: solo se puede pedir teniéndolo delante, y una
   *  perla para cruzar cuatro bloques no tenía sentido. El scroll se mueve al
   *  sitio y el suavizado del mundo hace la caminata. */
  const climbPodium = useCallback(() => {
    if (teleportingRef.current || podiumRef.current > 0) return
    play('button')
    podiumFromRef.current = worldFromScroll(window.scrollY)
    podiumAskRef.current = true
    window.scrollTo({ top: scrollFromWorld(PODIUM_AT), behavior: 'auto' })
  }, [])

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

  /** Coloca el escenario para que su sitio en el estrado caiga bajo el
   *  personaje cuando el mundo está en `PODIUM_AT`. Con `viewW` y no con
   *  `window`: de aquí sale también la posición del cofre, que sí se pinta en
   *  el servidor, y leer la ventana daba un valor distinto al hidratar. */
  const stageAnchor =
    PODIUM_AT * WORLD_LENGTH + viewW * (PODIUM_X / 100) - STAGE.anchorX * ((worldPx || 1080) / WORLD_UNIT)

  // El cofre va pegado al estrado por la izquierda, dejando el hueco justo
  // para el personaje. En el `at` de la sección caía encima del primer puesto.
  const stageScale = (worldPx || 1080) / WORLD_UNIT
  const chestLeft = stageAnchor + (STAGE.anchorX + STAGE.from - CHEST_GAP - CHEST_PX) * stageScale
  chestAtRef.current =
    (chestLeft + (CHEST_PX + CHEST_GAP / 2) * stageScale - viewW * (ENTRY_TO / 100)) / WORLD_LENGTH

  /** Coloca la tesela del acantilado para que el borde del vacío caiga justo
   *  donde se planta el personaje cuando el mundo llega a su fin. */
  const cliffAnchor =
    WORLD_LENGTH + (typeof window === 'undefined' ? 0 : window.innerWidth * (CLIFF_X / 100)) -
    CLIFF_EDGE * tileWidth

  return (
    <main
      ref={rootRef}
      data-lite={lite ? 'true' : undefined}
      className={styles.page}
      style={
        {
          height: pageHeight,
          '--char-feet': `${feetVhRef.current * worldPx}px`,
          '--world-h': `${worldPx}px`,
          // El terreno se apaga y se enfría con la noche. Así el mismo render
          // sirve para cualquier hora sin volver a pasarlo por Mine-imator.
          // De día no lleva `hue-rotate`: a 0° no hace nada y era un paso más
          // en el filtro de cada capa, en cada frame.
          '--world-grade': `brightness(${1.1 - night * 0.62}) contrast(${1.08 - night * 0.1}) saturate(${1.06 - night * 0.5})${night > 0 ? ` hue-rotate(${night * 12}deg)` : ''}`,
          // Los comparten el cielo y la niebla de las capas.
          '--sky-top': sky.top,
          '--sky-mid': sky.mid,
          '--sky-bottom': sky.bottom,
          '--night': night,
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
                half={half || lite}
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

        {/* La noche del modo ligero. Va sobre el mundo y bajo el personaje. */}
        <div className={styles.nightVeil} aria-hidden="true" />

        {phase === 'entering' || phase === 'ready' ? (
          <div
            ref={actorRef}
            className={`${styles.actor} ${hidden ? styles.actorGone : ''}`}
            style={{ left: phase === 'entering' ? `${ENTRY_FROM}%` : `${actorXRef.current}%` }}
          >
            <Character
              state={characterState}
              charHeight={charHeight}
              driven={characterState !== 'idle' && characterState !== 'cheer'}
              half={spriteHalf}
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
              half={half || lite}
              extend={s.biome === 'b5' ? 2 : 0}
              anchor={s.biome === 'b5' ? cliffAnchor : undefined}
            />
          ))}
        </div>

        {/* El escenario del podio: una sola copia, plantada en la taiga. */}
        <div ref={propsRef} className={`${layerStyles.box} ${styles.props}`}>
          {mounted
            .map((i) => SECTIONS[i])
            .filter((s) => s.id === 'proyectos')
            .map((s) => (
              <Strip
                key="stage"
                src="/layers/b2_stage.webp"
                travel={WORLD_LENGTH}
                tileWidth={tileWidth}
                tileHeight={heightOf('b2_stage')}
                speed={LAYER_SPEED.ground}
                viewport={viewW}
                {...spanOf(SECTIONS.indexOf(s), LAYER_SPEED.ground)}
                half={half || lite}
                anchor={stageAnchor}
              />
            ))}
        </div>

        <Inventory
          title="Proyectos"
          projects={PROJECTS}
          openness={chestOpen}
          onPodium={climbPodium}
        />
        <Podium openness={podiumOpen} />
        {meter ? <PerfMeter /> : null}

        {/* Todas las hojas del personaje, pintadas ya: un píxel de cada una, a
            la escala a la que se van a usar. Una hoja se decodifica la primera
            vez que se pinta, y eso era un tirón justo al echar a andar, al
            lanzar o al subir al podio. `decode()` no vale para fondos CSS. */}
        {phase === 'ready' ? (
          <div className={styles.warm} aria-hidden="true">
            {STATES.map((state) => {
              const sheet = SHEET_GEOMETRY[state]
              const scale = charHeight / sheet.charHeight
              return (
                <span
                  key={state}
                  style={{
                    backgroundImage: `url(${sheetSrc(state, spriteHalf)})`,
                    backgroundSize: `${CELL_WIDTH * scale * sheet.frames}px ${CELL_HEIGHT * scale}px`,
                  }}
                />
              )
            })}
          </div>
        ) : null}
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
          {/* El escenario entero se pulsa. Lo que avisa de ello es una medalla
              flotando a la entrada, como un objeto soltado en el juego: sobre
              el primer puesto caía bajo el cajón de proyectos y no se veía. */}
          {mounted.some((i) => SECTIONS[i].id === 'proyectos') && podiumOpen === 0 ? (
            <button
              type="button"
              className={styles.podiumHit}
              aria-label="Subir al podio"
              style={{
                left: stageAnchor + (STAGE.anchorX + STAGE.from) * stageScale,
                width: (STAGE.to - STAGE.from) * stageScale,
                height: (STAGE.first.up + 560) * stageScale,
              }}
              onClick={climbPodium}
            >
              <span
                className={styles.medal}
                style={{
                  left: -STAGE.from * stageScale,
                  bottom: (STAGE.lift + MEDAL.up) * stageScale,
                  width: MEDAL.width * stageScale,
                }}
              >
                <PodiumMedal />
                <span className={styles.medalHint}>Subir al podio</span>
              </span>
            </button>
          ) : null}
          {SECTIONS.filter((section) => section.id === 'proyectos' || section.id === 'contacto').map(
            (section) => (
              <section
                key={section.id}
                id={section.id}
                className={styles.marker}
                style={{
                  left: section.id === 'proyectos' ? chestLeft : section.at * WORLD_LENGTH,
                }}
              >
                {section.id === 'contacto' ? (
                  <Signs openness={signsOpen} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chestOpen > 0.4 ? '/textures/chest_open.webp' : '/textures/chest_closed.webp'}
                    alt=""
                    className={styles.chest}
                    style={{ width: CHEST_PX * stageScale }}
                  />
                )}
              </section>
            ),
          )}
        </div>

        {lite ? null : <Weather stateRef={weatherRef} worldDeltaRef={worldDeltaRef} />}

        {phase === 'greeting' ? (
          <div className={styles.greeter}>
            <SpriteGrid
              src={peekSrc(viewW > 0 && viewW < HALF_RES_WIDTH)}
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
