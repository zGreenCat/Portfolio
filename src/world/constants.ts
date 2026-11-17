/**
 * Las medidas del mundo: cuánto mide, a qué ritmo corre cada cosa y dónde
 * está cada sección. Sin React, para poder probar lo que se calcula con ellas.
 */
import {
  CELL_HEIGHT,
  SHEETS,
  wantsHalfSheet,
  type CharacterState,
} from '../components/characterSheets.ts'
import type { WeatherKind } from '../components/Weather'
import { GROUND_BELOW, WORLD_UNIT } from '../content/layers.ts'

export const PRELOAD = [
  '/sprites/run.webp',
  '/sprites/idle.webp',
  '/layers/b1_ground.webp',
  '/layers/b1_near.webp',
  '/layers/b1_mid.webp',
  '/layers/b1_far.webp',
]

export const BAR_CELLS = 14
export const MIN_LOADING_MS = 500
export const MAX_LOADING_MS = 1500

/** Sin los 5 frames vacíos del original: cuatro al inicio y uno al final, que
 *  eran 0,4 s de nada. Y a 18 fps en vez de 12: los 12 venían de cuando el
 *  saludo iba gobernado por scroll, pero se reproduce solo y se veía a tirones. */
export const PEEK = { cellWidth: 960, cellHeight: 570, columns: 8, rows: 4, frames: 32, fps: 18 }
/** El saludo pesa lo suyo descomprimido —70 MB entero— y va en la carga que
 *  bloquea la pantalla, así que en pantallas pequeñas se sirve a la mitad. La
 *  celda se declara igual en los dos casos: el fondo se escala al tamaño pedido. */
export const peekSrc = (half: boolean) => `/sprites/peek_wave${half ? '@half' : ''}.webp`

/** Con los botones de andar: anchos de pantalla por segundo, andando y
 *  corriendo. En pantalla y no en bloques: en un móvil el mundo es pequeño y
 *  a velocidad de bloques cruzarlo llevaba un minuto. */
export const WALK_SCREENS = 0.4
export const RUN_SCREENS = 1.25

/** Lo que el mundo se acerca al scroll en un frame a 60 Hz. */
export const WORLD_EASE = 0.12

/** Alto de página dedicado al recorrido. */
export const SCROLL_LENGTH = 7000

/**
 * La ÚNICA correspondencia entre scroll y mundo. Estaba repetida en seis
 * sitios; tenerla aquí es lo que permite moverla sin que alguno se quede atrás.
 */
export const worldFromScroll = (y: number) => Math.min(1, Math.max(0, y / SCROLL_LENGTH))
export const scrollFromWorld = (at: number) => at * SCROLL_LENGTH
/** Píxeles de mundo que recorre la capa del suelo de punta a punta. */
export const WORLD_LENGTH = 12000
/** El ancho de una tesela, en unidades de la caja del mundo. */
export const LAYER_ASPECT = 3840 / WORLD_UNIT
/** Bloques que avanza cada ciclo. Caminar cubre menos suelo por zancada, así
 *  que su ciclo tiene que ir más apretado o los pies patinan. */
export const STRIDE: Record<CharacterState, number> = {
  run: 2.1,
  walk: 1.25,
  idle: 1,
  throw: 1,
  sit: 1,
  climb: 1,
  cheer: 1,
  type: 1,
}
/** Umbrales de marcha, en bloques por segundo. `walk` cubre 1,25 bloques en
 *  25 frames: por encima de ~2 b/s su ciclo se dispara, así que ahí ya corre. */
export const SPEED_RUN = 2.2
export const SPEED_WALK = 0.45
/** Para dejar de correr hay que bajar bastante más de lo que costó arrancar.
 *  Con un solo umbral, frenando cerca de él la marcha cambiaba en cada frame:
 *  correr, caminar, correr. */
export const SPEED_RUN_OFF = 1.4
/** La marcha se elige con la velocidad suavizada, no con la del frame, y
 *  suavizada despacio. Un golpe de rueda son más de 13 bloques por segundo
 *  que se apagan en un cuarto de segundo: con la del frame, cada golpe era
 *  correr, caminar y parar. Así varios golpes seguidos son correr, que es lo
 *  que dice su media. */
export const PACE_SECONDS = 0.55
/** Cadencia mínima de cada marcha, en zancadas por segundo. La zancada sale
 *  de la distancia recorrida, y frenando esa distancia se acaba antes que la
 *  marcha: se quedaba un cuarto de segundo clavado en una pose de correr. Con
 *  un mínimo termina el paso en vez de congelarse. Queda por debajo de lo que
 *  cada marcha da a su velocidad más baja, así que solo actúa al frenar. */
export const MIN_CADENCE: Partial<Record<CharacterState, number>> = { run: 1, walk: 0.5 }
/** Lo que una marcha se mantiene antes de poder cambiar a la otra. */
export const GAIT_HOLD_SECONDS = 0.25
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
export const MAX_SHEET_FPS = 34
/** Tiempo seguido por debajo del umbral antes de pasar a reposo. Corto: en
 *  esa espera la zancada no avanza, y con 0,3 s se quedaba clavado en la pose
 *  de correr al frenar. No hace falta más para la rueda: un golpe tarda unos
 *  300 ms en apagarse, así que golpes seguidos no llegan a esta espera.
 *
 *  En segundos, como todo lo de la marcha. Estuvo en frames, y en un monitor
 *  de 120 Hz valía la mitad. */
export const IDLE_SECONDS = 0.1
/** Lado de la perla respecto al alto del personaje: los 32 px que medía en un
 *  escritorio normal, hechos proporción. */
export const PEARL_OF_CHARACTER = 0.176
/** Duración del lanzamiento completo. */
export const THROW_MS = 700
/** Dónde empieza a caer la tarde y dónde es noche cerrada, en progreso de
 *  mundo. El anochecer se reparte por el último tercio para que se perciba
 *  como un viaje largo, no como un cambio de bioma. */
export const DUSK_FROM = 0.62
export const NIGHT_AT = 0.94
/** Alto del personaje como fracción del alto del MUNDO, no de la pantalla. */
/** Alto del personaje como fracción de la caja del mundo. Medido sobre la
 *  pasada `ref`, que trae al personaje colocado a escala de mundo: 271 px. */
export const CHAR_HEIGHT_VH = 271 / WORLD_UNIT
/** En vertical el mundo no ocupa toda la pantalla: escalarlo al alto dejaba
 *  ver 5 bloques y el personaje se comía el 40% del ancho. Ocupando la franja
 *  baja entra el triple de mundo y queda cielo arriba, que es donde vive el
 *  título. */
export const PORTRAIT_WORLD = 0.46
/** Por debajo de este ancho el saludo va a mitad de resolución, y las capas
 *  también, sin mirar nada más. */
export const HALF_RES_WIDTH = 900
/** Ancho de una capa a media resolución, en sus propios píxeles. */
export const HALF_LAYER_PX = 1920
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
export const FULL_RES_FROM = 1.7

/** ¿Tocan las hojas del personaje a la mitad en esta ventana? */
export function wantsHalfSprites(): boolean {
  const portrait = window.innerHeight > window.innerWidth
  const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
  const cell = world * CHAR_HEIGHT_VH * (CELL_HEIGHT / SHEETS.idle.charHeight)
  return wantsHalfSheet(cell * window.devicePixelRatio)
}

/** ¿Tocan las capas a media resolución en esta ventana? */
export function wantsHalfLayers(): boolean {
  if (window.innerWidth < HALF_RES_WIDTH) return true
  const portrait = window.innerHeight > window.innerWidth
  const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
  return world * LAYER_ASPECT * window.devicePixelRatio < HALF_LAYER_PX * FULL_RES_FROM
}
/** Sale por el borde de abajo y ocupa media pantalla de alto. En vertical eso
 *  lo haría más ancho que la pantalla y los brazos se cortarían por los lados,
 *  así que el ancho también pone tope. */
export const PEEK_CELL_VH = 0.5
export const PEEK_CELL_VW = 0.96

export const ENTRY_FROM = -28
/** Posición del personaje en pantalla, en %. Es también su centro visual:
 *  Character se desplaza -centerX, así que `left` cae en su eje. */
export const ENTRY_TO = 20
/** Fila del render donde caen los pies en b1. De ahí sale --char-feet: los
 *  pies van 26 px por debajo de la superficie, dentro de la banda de hierba. */
/** Cuánto se hunde el pie por debajo de la superficie. Medido sobre la `ref`:
 *  pies en la fila 2738 con la superficie en 2716. */
export const FEET_BELOW_SURFACE = 22
export const CHAR_FEET_VH = (GROUND_BELOW - FEET_BELOW_SURFACE) / WORLD_UNIT
/** Entra caminando, no corriendo: viene de saludar, no de una carrera.
 *  Más lento que antes porque a paso de caminata 1,4 s se leía como prisa. */
export const ENTRY_SECONDS = 2.2

export const LAYER_SPEED = { far: 0.15, mid: 0.3, near: 0.55, ground: 1 } as const

export const ALL_KINDS = ['far', 'mid', 'near', 'ground'] as const
export const END_KINDS = ['far', 'ground'] as const
export type Kind = (typeof ALL_KINDS)[number]

/** Las secciones son lugares del mundo, no pantallas: `at` es su posición.
 *  Cada una tiene su bioma; el prefijo nombra los cuatro archivos de capa. */
/** `surfaceY` es la fila del render donde está la superficie que se pisa.
 *  No es la misma en todos: la taiga lleva capa de nieve encima de la hierba y
 *  su suelo queda 17 px más alto. En vez de pedir que lo igualen —que sería
 *  quitarle la nieve— el personaje sube con el terreno. */
export const SECTIONS = [
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
export const atOf = (id: (typeof SECTIONS)[number]['id']) =>
  SECTIONS.find((section) => section.id === id)?.at ?? 0

/** Fracción de la tesela donde se acaba el suelo del acantilado. */
export const CLIFF_EDGE = 2371 / 3840
/** En el acantilado el personaje se desplaza hacia el centro. El árbol queda
 *  772 px a la izquierda del borde del vacío, y con él al 20% se salía de
 *  cuadro. Además, encuadrar más abierto sienta mejor a un final. */
export const CLIFF_X = 48
export const CLIFF_FROM = 0.84
/**
 * Sentarse es lo único del recorrido que NO va atado a la posición: es un gesto
 * que se hace en el sitio al llegar al borde, no algo que se rasque con la
 * rueda. Avanza por tiempo y se queda en el último frame.
 *
 * Retroceder lo reproduce hacia atrás al mismo ritmo, así que el personaje se
 * levanta en vez de saltar de golpe a estar de pie.
 */
export const SIT_AT = 0.998
/** Hay que retroceder de verdad para que se levante. Sin esta holgura, un roce
 *  de rueda en el borde bajaba del umbral y arrancaba el gesto contrario al
 *  instante: ir y venir así se lee como si la animación siguiera a la rueda. */
export const SIT_RELEASE = 0.97
export const SIT_SECONDS = 1.35
/** Tope de velocidad, en bloques por segundo, SOLO para recuperar la distancia
 *  que se acumuló mientras el mundo estaba congelado. El suavizado normal sigue
 *  sin tope: ponérselo a todo ya causó sensación de lag en su día. */
export const CATCH_UP_BLOCKS = 14

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
export const LITE_SAMPLE = 120
/** 40 fps de media. Estuvo en 33 ms —30 fps—, y un equipo a 35–45 iba a
 *  tirones sin que saltara nunca. */
export const LITE_MS = 25

/** Tramo de mundo, en unidades de progreso, en el que el personaje sube o baja
 *  entre las superficies de dos biomas. El terreno cambia de golpe —como en el
 *  juego— pero un salto de 37 px en los pies sí se notaría. */
export const FEET_EASE = 0.03
/** Fuera de este radio el bioma se desmonta: cuatro capas de 3840×1440 son
 *  ~88 MB de memoria descomprimida, y cinco biomas a la vez matan un móvil. */
export const MOUNT_RADIUS = 0.34
/** Radio en el que un bioma se descomprime por adelantado, antes de montarse.
 *  Descomprimir una capa de 3840×1440 cuesta bastante y caía justo al cruzar
 *  la frontera; adelantarlo lo mete en un tramo tranquilo. */
export const PREWARM_RADIUS = MOUNT_RADIUS + 0.14
export const PREWARM_DROP = PREWARM_RADIUS + 0.05

/** Escalones de la noche y de la apertura de paneles. Los dos alimentan estado
 *  de React: cuantizarlos convierte 60 re-render/s en unos pocos por tramo. La
 *  noche además mueve un `filter` sobre superficies del ancho del mundo. */
export const NIGHT_STEPS = 24
export const PANEL_STEPS = 20

/** Distancias de apertura de los paneles, en unidades de progreso del mundo.
 *  Se cierran más lejos de lo que se abren: sin esa histéresis, un roce de
 *  rueda mientras lees el panel lo haría parpadear. */
export const PANEL_OPEN_AT = 0.058
export const PANEL_CLOSE_AT = 0.098

export const SPLASHES = [
  '¡Hecho con bloques!',
  'Sin plantillas',
  'Renderizado a mano',
  '¡Prueba la perla!',
  'Ahora con parallax',
  'Se acepta feedback',
]
