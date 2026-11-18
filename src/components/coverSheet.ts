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

/** Dónde corta la diagonal de la portada el borde de arriba y el de abajo,
 *  como fracción del ancho. Las mismas del `clip-path` de `.paper`. */
export const SEAM = { top: 0.6, bottom: 0.4 } as const

/** La x de la costura a una altura `y`, en una pantalla de `width` × `height`. */
export function seamX(y: number, width: number, height: number): number {
  if (!(height > 0)) throw new Error(`seamX: el alto tiene que ser positivo, llegó ${height}`)
  return width * (SEAM.top + (SEAM.bottom - SEAM.top) * (y / height))
}

/**
 * Dónde va el tirador de «Recorrer el mundo»: sobre la costura, a media
 * altura del hueco que queda entre el nombre y sus cabezas. `nameBottom` y
 * `pairTop` son esas dos alturas, en píxeles.
 */
export function knobSpot(
  nameBottom: number,
  pairTop: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const y = (nameBottom + pairTop) / 2
  return { x: seamX(y, width, height), y }
}
