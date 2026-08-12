/**
 * Alto de cada capa del mundo, en píxeles del render, ya recortada.
 *
 * Por arriba se recorta hasta donde empieza el contenido, así que cada capa
 * mide lo suyo. Por abajo se corta a una distancia fija bajo la superficie del
 * bioma, la misma en todos: así el personaje queda siempre a la misma altura
 * sobre el borde de la capa y la línea del suelo no da un escalón al cruzar,
 * aunque cada escena se haya construido a una altura distinta.
 *
 * Generado por scripts/import-layers.py — no editar a mano.
 */
export const LAYER_HEIGHT: Record<string, number> = {
  'b1_far': 2091,
  'b1_ground': 1014,
  'b1_mid': 1562,
  'b1_near': 1066,
  'b2_far': 2020,
  'b2_ground': 945,
  'b2_mid': 2002,
  'b2_near': 1598,
  'b3_far': 1729,
  'b3_ground': 548,
  'b3_mid': 1037,
  'b3_near': 666,
  'b4_far': 1719,
  'b4_ground': 1587,
  'b4_mid': 1570,
  'b4_near': 1690,
  'b5_far': 1179,
  'b5_ground': 1587,
}

/** Píxeles de render conservados por debajo de la superficie, en toda capa. */
export const GROUND_BELOW = 151

/** Píxeles de render por bloque. Medido por autocorrelación del suelo. */
export const BLOCK_PX_SOURCE = 133

/**
 * Píxeles de render que ocupa la caja del mundo en pantalla.
 *
 * Sale de conservar el encuadre original: la caja medía 1440 px de un render
 * de 143 px por bloque, o sea 10,07 bloques de alto. A 133 px por bloque eso
 * son 1339. Sin esto, mapear los 3000 px del render a la misma caja dejaría
 * el mundo a menos de la mitad de tamaño.
 */
export const WORLD_UNIT = 1339
