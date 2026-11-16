import type { CSSProperties, Ref } from 'react'

import { CELL_HEIGHT, CELL_WIDTH, SHEETS, sheetSrc, type CharacterState } from './characterSheets'
import styles from './Character.module.css'

export {
  CELL_WIDTH,
  FRAME_COUNT,
  SHEETS as SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from './characterSheets'

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
  /** Sirve la hoja a la mitad. El tamaño en pantalla no cambia: el fondo se
   *  escala a la celda pedida. */
  half?: boolean
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
export default function Character({ state, charHeight, driven, half = false, spriteRef }: CharacterProps) {
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
    backgroundImage: `url(${sheetSrc(state, half)})`,
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
