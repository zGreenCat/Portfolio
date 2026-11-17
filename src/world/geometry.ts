/**
 * Lo que se calcula con las medidas del mundo: el territorio de cada bioma,
 * en cuál estás, cuánto se abre un panel. Sin React.
 */
import {
  CLIFF_EDGE,
  CLIFF_X,
  FEET_EASE,
  LAYER_ASPECT,
  PANEL_CLOSE_AT,
  PANEL_OPEN_AT,
  SECTIONS,
  WORLD_LENGTH,
} from './constants.ts'

/**
 * Cuánto hay que correr el suelo de los cerezos para que `frontier` caiga en
 * el centro de un claro.
 *
 * Su tesela lleva un árbol en la primera mitad y el resto despejado. Repetida
 * alternando volteada, los claros se juntan de dos en dos alrededor de cada
 * unión impar: en T, 3T, 5T… Así que se corre hasta que la frontera caiga en
 * una de esas. Vale igual para la capa `near`, que tiene el árbol en el centro
 * de la tesela y el claro más ancho en las mismas uniones.
 */
export function clearingPhase(frontier: number, tile: number): number {
  const period = 2 * tile
  return (((frontier - tile) % period) + period) % period
}

export const quantize = (value: number, steps: number) => Math.round(value * steps) / steps

export const layerSrc = (biome: string, kind: string, half: boolean) =>
  `/layers/${biome}_${kind}${half ? '@half' : ''}.webp`

/** Cuánto está abierto el panel de una sección según lo cerca que estés. */
export function panelOpenness(at: number, world: number): number {
  const d = Math.abs(at - world)
  return Math.min(1, Math.max(0, 1 - (d - PANEL_OPEN_AT) / (PANEL_CLOSE_AT - PANEL_OPEN_AT)))
}

/**
 * Territorio de cada bioma, en progreso de mundo. La frontera cae a mitad de
 * camino entre dos secciones.
 *
 * Cada bioma se **recorta** a su territorio en vez de fundirse con el vecino.
 * Fundir mostraba los dos terrenos a la vez —cactus sobre cerezos— y además
 * dejaba pasar el cielo, porque dos capas al 50% componen un 75%, no un 100%.
 *
 * Una frontera dura tampoco es una concesión: en Minecraft los biomas cambian
 * de golpe.
 */
export function makeBounds(viewport: number, tile: number) {
  const bounds = SECTIONS.map((section, i) => {
    const prev = SECTIONS[i - 1]
    const next = SECTIONS[i + 1]
    return {
      from: prev ? (prev.at + section.at) / 2 : -Infinity,
      to: next ? (section.at + next.at) / 2 : Infinity,
    }
  })

  // La primera frontera se empuja más allá del borde derecho de la pantalla:
  // con el bioma de inicio midiendo menos de un viewport, se veía el siguiente
  // nada más entrar, antes de haber caminado nada.
  const clear = (viewport * 1.12) / WORLD_LENGTH
  if (bounds[0].to < clear) {
    bounds[0].to = clear
    bounds[1].from = clear
  }

  // La frontera con el acantilado no va a mitad de camino sino en un claro. Su
  // suelo es una tesela con un cerezo en la primera mitad y el tramo final
  // despejado, repetida hacia atrás de espaldas a sí misma: los claros caen
  // donde se juntan dos finales, cada dos copias. A mitad de camino el recorte
  // partía un árbol en dos. Se elige el claro más cercano a esa mitad, y como
  // la tesela mide según la pantalla, la frontera también.
  const last = bounds.length - 1
  const ground = CLIFF_EDGE * tile
  const anchor = WORLD_LENGTH + viewport * (CLIFF_X / 100) - ground
  const midway = bounds[last].from * WORLD_LENGTH
  const clearings = [1, 3, 5]
    .map((copies) => (anchor - copies * ground) / WORLD_LENGTH)
    .filter((at) => at > SECTIONS[last - 1].at + 0.03 && at < SECTIONS[last].at - 0.03)
  if (clearings.length > 0) {
    const frontier = clearings.reduce((best, at) =>
      Math.abs(at * WORLD_LENGTH - midway) < Math.abs(best * WORLD_LENGTH - midway) ? at : best,
    )
    bounds[last - 1].to = frontier
    bounds[last].from = frontier
  }
  return bounds
}

/** Se recalcula al cambiar la ventana, con `fitBounds`: quien lo importa lee
 *  siempre el vigente. */
export let BOUNDS = makeBounds(1920, 1080 * LAYER_ASPECT)

export function fitBounds(viewport: number, tile: number) {
  BOUNDS = makeBounds(viewport, tile)
}

/** Índice del bioma que pisas, y cuánto has entrado en el siguiente. */
export function biomeAt(world: number): { index: number; blend: number; next: number } {
  let index = 0
  BOUNDS.forEach((b, i) => {
    if (world >= b.from) index = i
  })
  const edge = BOUNDS[index].to
  const next = Math.min(SECTIONS.length - 1, index + 1)
  const blend =
    edge === Infinity ? 0 : Math.min(1, Math.max(0, (world - (edge - FEET_EASE)) / FEET_EASE))
  return { index, blend, next }
}
