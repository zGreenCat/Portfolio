/**
 * La hoja del avatar de la portada: de tres cuartos y de brazos cruzados,
 * como Vicente en la foto que tiene al lado. Sin React ni navegador, para
 * poder probarla contra el archivo.
 *
 * No es una animación: son poses sueltas, y la página elige cuál enseñar.
 * Las cinco primeras son miradas, de izquierda a derecha; las dos últimas,
 * un parpadeo (a medio cerrar y cerrado). El orden lo pone
 * `scripts/render/gen_duo.py` y tiene que coincidir.
 */
export const DUO = {
  src: '/sprites/duo.webp',
  halfSrc: '/sprites/duo@half.webp',
  frames: 7,
  /** Celda de la hoja entera. La imprime `render_all.sh` al recortarla. */
  cellWidth: 605,
  cellHeight: 1029,
  gazes: 5,
  halfShut: 5,
  shut: 6,
} as const

/** Por debajo de este alto en píxeles físicos basta la hoja a la mitad. */
const FULL_DUO_FROM = 620

export const wantsHalfDuo = (physicalHeight: number) => physicalHeight < FULL_DUO_FROM

/**
 * Qué mirada toca según dónde está el puntero. `reach` es la distancia a la
 * que ya mira del todo hacia ese lado: más allá no gira más.
 */
export function gazeFrame(pointerX: number, centerX: number, reach: number): number {
  if (!(reach > 0)) throw new Error(`gazeFrame: reach tiene que ser positivo, llegó ${reach}`)
  const side = Math.max(-1, Math.min(1, (pointerX - centerX) / reach))
  return Math.round(((side + 1) / 2) * (DUO.gazes - 1))
}

/** Desplazamiento del fondo, en porcentaje, que enseña la pose `frame`. */
export function framePosition(frame: number): string {
  if (!Number.isInteger(frame) || frame < 0 || frame >= DUO.frames) {
    throw new Error(`framePosition: la hoja no tiene la pose ${frame}`)
  }
  return `${(frame / (DUO.frames - 1)) * 100}%`
}
