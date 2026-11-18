/**
 * La página de dirección equivocada: la hoja del personaje que cae al End y
 * la isla en la que cae. Sin nada de React ni del navegador, para probarlo.
 */

/** Los tramos de la hoja, uno tras otro: cuántos frames tiene cada uno. Los
 *  escribe `scripts/render/gen_fall.py` (`SEGMENTS`), y tienen que coincidir:
 *  lo comprueba `tests/lost-sheet.test.mjs`. */
export const SEGMENTS = { fall: 6, land: 8, look: 16 } as const

export type Segment = keyof typeof SEGMENTS

export const LOST = {
  src: '/sprites/fall.webp',
  halfSrc: '/sprites/fall@half.webp',
  cellWidth: 460,
  cellHeight: 600,
  frames: SEGMENTS.fall + SEGMENTS.land + SEGMENTS.look,
  /** Fila de la celda donde apoya el pie y columna de su eje, como en las
   *  demás hojas del rig. */
  footY: 540,
  centerX: 232,
} as const

/** Primer y último frame de un tramo, por su índice en la hoja. */
export function span(name: Segment): [number, number] {
  let start = 0
  for (const [key, count] of Object.entries(SEGMENTS)) {
    if (key === name) return [start, start + count - 1]
    start += count
  }
  throw new Error(`La hoja no tiene el tramo «${name}»`)
}

/** Posición del fondo que enseña un frame, en porcentaje: la hoja es una
 *  fila, y el 100% es el último. */
export function frameAt(frame: number): number {
  if (!Number.isInteger(frame) || frame < 0 || frame >= LOST.frames) {
    throw new Error(`La hoja no tiene el frame ${frame}`)
  }
  return (frame / (LOST.frames - 1)) * 100
}

/**
 * La isla, en píxeles del render ya recortado a lo pintado. `land` es donde
 * pisa: lo imprime `world.py` (`ANCHOR land`), menos el recorte. `cell` es lo
 * que mide en ese render la celda del personaje, a 133 px por bloque.
 */
export const ISLAND = {
  src: '/end/island.webp',
  width: 2102,
  height: 2001,
  land: { x: 724.4, y: 913.9 },
  cellHeight: 372,
} as const

/** Dónde va la celda del personaje sobre la isla, en porcentajes de ella. */
export function heroBox() {
  const height = ISLAND.cellHeight
  const width = (height * LOST.cellWidth) / LOST.cellHeight
  return {
    left: ((ISLAND.land.x - (width * LOST.centerX) / LOST.cellWidth) / ISLAND.width) * 100,
    top: ((ISLAND.land.y - (height * LOST.footY) / LOST.cellHeight) / ISLAND.height) * 100,
    width: (width / ISLAND.width) * 100,
  }
}
