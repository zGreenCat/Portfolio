import type { CSSProperties, Ref } from 'react'

import styles from './Character.module.css'

export type CharacterState = 'run' | 'walk' | 'idle' | 'throw' | 'sit'

export const CELL_WIDTH = 460
const CELL_HEIGHT = 600

/**
 * Geometría medida de cada hoja. Las dos se renderizaron con cámaras distintas,
 * así que el personaje no ocupa lo mismo dentro de la celda: en `idle` mide un
 * 90% de lo que mide en `run`. Sin corregirlo, encoge al pararse.
 *
 * - `charHeight`: alto del personaje dentro de la celda, en píxeles de origen
 * - `footY`: fila donde apoya el pie (mediana del ciclo, no el frame más bajo:
 *   con el mínimo, los demás frames quedaban flotando)
 * - `centerX`: centro horizontal del personaje dentro de la celda
 */
const SHEETS = {
  // run2 puesto temporalmente en el sitio de run, para comparar.
  run: { src: '/sprites/run.webp', frames: 16, charHeight: 367, footY: 512, centerX: 230 },
  walk: { src: '/sprites/walk.webp', frames: 25, charHeight: 399, footY: 526, centerX: 242 },
  idle: { src: '/sprites/idle.webp', frames: 16, charHeight: 404, footY: 548, centerX: 232 },
  throw: { src: '/sprites/throw.webp', frames: 19, charHeight: 400, footY: 523, centerX: 190 },
  // La geometría sale del frame 1, que es el personaje DE PIE: así la hoja se
  // ancla contra `idle` en vez de estimar dónde queda el cuerpo al sentarse,
  // que es lo que cambia de sitio. `centerX` coincide con el de `idle`.
  sit: { src: '/sprites/sit.webp', frames: 31, charHeight: 411, footY: 556, centerX: 232 },
} as const

/** Frame en el que la mano suelta la perla, y dónde está esa mano dentro de la
 *  celda. Medido sobre Throw_15, que es la máxima extensión del brazo. */
export const THROW_RELEASE = { frame: 15, handX: 362, handY: 240 } as const

export const FRAME_COUNT: Record<CharacterState, number> = {
  run: SHEETS.run.frames,
  walk: SHEETS.walk.frames,
  idle: SHEETS.idle.frames,
  throw: SHEETS.throw.frames,
  sit: SHEETS.sit.frames,
}

/** Geometría de cada hoja, para que la página pueda situar la mano. */
export const SHEET_GEOMETRY = SHEETS

interface CharacterProps {
  state: CharacterState
  /** Alto que debe medir el personaje en pantalla, en píxeles. */
  charHeight: number
  /**
   * El frame lo escribe el bucle sobre el nodo, no React: la zancada va atada
   * al avance real y eso cambia en cada frame. Con `driven`, el sprite deja de
   * animarse por CSS y espera esa escritura.
   */
  driven?: boolean
  spriteRef?: Ref<HTMLDivElement>
}

const labels: Record<CharacterState, string> = {
  run: 'Personaje corriendo',
  walk: 'Personaje caminando',
  idle: 'Personaje en reposo',
  throw: 'Personaje lanzando una perla',
  sit: 'Personaje sentado en el borde del acantilado',
}

/**
 * Se coloca solo: el pie de apoyo cae exactamente en el borde inferior del
 * contenedor, y el personaje queda centrado en su borde izquierdo. Así el
 * contenedor solo tiene que estar a la altura del suelo, y cambiar de hoja no
 * mueve nada.
 */
export default function Character({ state, charHeight, driven, spriteRef }: CharacterProps) {
  const sheet = SHEETS[state]
  const scale = charHeight / sheet.charHeight

  const width = CELL_WIDTH * scale
  const height = CELL_HEIGHT * scale
  const footOffset = (CELL_HEIGHT - sheet.footY) * scale
  const centerOffset = sheet.centerX * scale

  const style = {
    width,
    height,
    bottom: -footOffset,
    left: -centerOffset,
    backgroundImage: `url(${sheet.src})`,
    backgroundSize: `${width * sheet.frames}px ${height}px`,
    '--sheet-span': `${width * sheet.frames}px`,
    // El volteo al andar hacia atrás pivota sobre el centro del personaje, no
    // sobre el borde de la celda: si no, al girarse daría un salto lateral.
    transformOrigin: `${centerOffset}px center`,
  } as CSSProperties

  return (
    <div
      ref={spriteRef}
      className={styles.character}
      data-state={state}
      data-driven={driven ? 'true' : undefined}
      style={style}
      role="img"
      aria-label={labels[state]}
    />
  )
}
