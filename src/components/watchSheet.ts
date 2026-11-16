/**
 * La hoja del personaje que mira la imagen en el visor, y en qué orden se
 * reproduce. Sin nada de React ni del navegador, para poder probarlo.
 */

/** Los tramos de la hoja, uno tras otro: cuántos frames tiene cada uno. Los
 *  escribe `scripts/render/gen_watch.py` (`SEGMENTS`), y tienen que coincidir:
 *  lo comprueba `tests/watch-sheet.test.mjs`. */
export const SEGMENTS = { intro: 6, rest: 12, point: 22, wonder: 24 } as const

export type Segment = keyof typeof SEGMENTS

/** Los frames de un tramo, por su índice en la hoja. */
export function segment(name: Segment): number[] {
  let start = 0
  for (const [key, count] of Object.entries(SEGMENTS)) {
    if (key === name) return Array.from({ length: count }, (_, i) => start + i)
    start += count
  }
  throw new Error(`La hoja no tiene el tramo «${name}»`)
}

const times = (frames: number[], count: number) => Array.from({ length: count }, () => frames).flat()

/**
 * Sube una vez y luego casi todo el tiempo solo mira; cada pocos segundos hace
 * algo, y no siempre lo mismo: señalar la imagen o quedarse pensando. Con los
 * dos gestos seguidos en un bucle corto no paraba quieto y se leía como un tic.
 */
export const WATCH = {
  src: '/sprites/peek_watch.webp',
  cellWidth: 640,
  cellHeight: 480,
  columns: 8,
  rows: 8,
  frames: SEGMENTS.intro,
  fps: 13,
  loop: [
    ...times(segment('rest'), 3),
    ...segment('point'),
    ...times(segment('rest'), 4),
    ...segment('wonder'),
    ...times(segment('rest'), 2),
  ],
}
