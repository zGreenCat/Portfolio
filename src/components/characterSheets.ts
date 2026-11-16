/**
 * Las hojas del personaje: qué hay en cada una y cuál se sirve. Sin nada de
 * React ni del navegador, para poder probarlo contra los archivos.
 */

export type CharacterState =
  | 'run'
  | 'walk'
  | 'idle'
  | 'throw'
  | 'sit'
  | 'climb'
  | 'cheer'
  | 'type'

export const CELL_WIDTH = 460
export const CELL_HEIGHT = 600

/**
 * Geometría de cada hoja. Hoy es la misma en todas: salen del rig de
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
export const SHEETS = {
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
  // Tecleando en el chat: el reposo con la cabeza baja y las manos delante.
  type: { src: '/sprites/type.webp', frames: 16, charHeight: 408, footY: 540, centerX: 232 },
} as const

export const STATES = Object.keys(SHEETS) as CharacterState[]

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
  type: SHEETS.type.frames,
}

/**
 * Las hojas que son un bucle por tiempo y las lleva el CSS: el bucle de la
 * página no les escribe el frame, y al entrar en ellas hay que borrar el que
 * hubiera dejado.
 */
export const loopsByItself = (state: CharacterState) =>
  state === 'idle' || state === 'cheer' || state === 'type'

/**
 * La celda entera (600 px) solo hace falta si en pantalla mide, en píxeles
 * físicos, más de esto veces la de la hoja a la mitad. Por debajo se sirve la
 * mitad.
 *
 * Las enteras se usaban siempre. En un portátil de 1080p la celda son 270 px
 * físicos: hojas 2,2 veces más grandes de lo que se veía, 18–35 MB cada una ya
 * decodificada, y cada una se decodificaba la primera vez que salía — un
 * tirón de 100–250 ms justo al echar a andar. Las dos más anchas, además,
 * rozan los 16.384 px que admite una textura, y muchos móviles se quedan en
 * 8.192.
 */
export const FULL_SHEET_FROM = 1.5

/** ¿Toca la hoja a la mitad para una celda de este alto en píxeles físicos? */
export function wantsHalfSheet(cellDevicePx: number): boolean {
  return cellDevicePx < (CELL_HEIGHT / 2) * FULL_SHEET_FROM
}

export function sheetSrc(state: CharacterState, half: boolean): string {
  const { src } = SHEETS[state]
  return half ? src.replace('.webp', '@half.webp') : src
}
