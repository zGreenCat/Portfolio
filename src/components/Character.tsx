import type { CSSProperties, Ref } from 'react'

import styles from './Character.module.css'

export type CharacterState = 'run' | 'walk' | 'idle' | 'throw' | 'sit' | 'climb' | 'cheer'

export const CELL_WIDTH = 460
const CELL_HEIGHT = 600

/**
 * Geometría de cada hoja. Hoy es la misma en las cinco: salen todas del rig de
 * `scripts/render/`, con una sola cámara. Sigue yendo por hoja porque el
 * componente escala con ella: cuando cada una venía de una cámara distinta, en
 * `idle` el personaje medía un 90% de lo que medía en `run` y encogía al
 * pararse.
 *
 * - `charHeight`: alto del personaje dentro de la celda, en píxeles de origen
 * - `footY`: fila donde apoya el pie (mediana del ciclo, no el frame más bajo:
 *   con el mínimo, los demás frames quedaban flotando)
 * - `centerX`: centro horizontal del personaje dentro de la celda
 */
const SHEETS = {
  run: { src: '/sprites/run.webp', frames: 16, charHeight: 408, footY: 540, centerX: 232 },
  walk: { src: '/sprites/walk.webp', frames: 25, charHeight: 408, footY: 540, centerX: 232 },
  idle: { src: '/sprites/idle.webp', frames: 16, charHeight: 408, footY: 540, centerX: 232 },
  throw: { src: '/sprites/throw.webp', frames: 19, charHeight: 408, footY: 540, centerX: 232 },
  // La geometría sale del frame 1, que es el personaje DE PIE: así la hoja se
  // ancla contra `idle` en vez de estimar dónde queda el cuerpo al sentarse,
  // que es lo que cambia de sitio. `centerX` coincide con el de `idle`.
  // `footY` es el suelo, no el punto más bajo: sentado, los pies cuelgan por
  // debajo, delante del cantil. La cámara la fija `scripts/render/rig.py`.
  sit: { src: '/sprites/sit.webp', frames: 31, charHeight: 408, footY: 540, centerX: 232 },
  // Subir al podio va dibujado en el sitio: los saltos los desplaza la página.
  climb: { src: '/sprites/climb.webp', frames: 32, charHeight: 408, footY: 540, centerX: 232 },
  cheer: { src: '/sprites/cheer.webp', frames: 16, charHeight: 408, footY: 540, centerX: 232 },
} as const

/** Frame en el que la mano suelta la perla, y dónde está esa mano dentro de la
 *  celda. Lo da el rig con su sonda, sobre el brazo ya extendido y nivelado. */
export const THROW_RELEASE = { frame: 15, handX: 394, handY: 278 } as const

export const FRAME_COUNT: Record<CharacterState, number> = {
  run: SHEETS.run.frames,
  walk: SHEETS.walk.frames,
  idle: SHEETS.idle.frames,
  throw: SHEETS.throw.frames,
  sit: SHEETS.sit.frames,
  climb: SHEETS.climb.frames,
  cheer: SHEETS.cheer.frames,
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
  climb: 'Personaje subiendo al podio',
  cheer: 'Personaje celebrando en el podio con su medalla',
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
