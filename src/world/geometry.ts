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
  SIT_AT,
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

/** Los biomas que hay que tener montados estando en `at`. */
export function sectionsNear(at: number, radius: number): number[] {
  const near: number[] = []
  SECTIONS.forEach((section, i) => {
    if (Math.abs(section.at - at) < radius) near.push(i)
  })
  return near
}

/** La sección más cercana: la que marca la barra. */
export function nearestSection(at: number): (typeof SECTIONS)[number] {
  return SECTIONS.reduce((best, section) =>
    Math.abs(section.at - at) < Math.abs(best.at - at) ? section : best,
  )
}

/**
 * Dónde aterriza quien se teletransporta a una sección. No es exactamente la
 * sección: caer justo encima deja la siguiente frontera de bioma dentro del
 * cuadro.
 *
 * La frontera aparece en pantalla en `edge - worldX`, medido desde el borde
 * IZQUIERDO. Para dejarla fuera hay que retroceder un viewport entero, no el
 * hueco que queda a la derecha del personaje. El retroceso está acotado por
 * `PANEL_OPEN_AT`: más atrás de eso, llegarías con el cajón entreabierto.
 *
 * `chestAt` es dónde queda el cofre de Experiencias, que no está en el `at`
 * de su sección: va delante del escenario, y ahí se abre su cajón.
 */
export function landingAt(index: number, chestAt: number, viewport: number): number {
  const section = SECTIONS[index]
  if (section.id === 'proyectos') return chestAt
  if (section.id === 'contacto') return contactLanding(viewport)
  const edge = BOUNDS[index].to
  if (edge === Infinity) return section.at
  const clear = edge - viewport / WORLD_LENGTH
  return Math.max(section.at - PANEL_OPEN_AT, Math.min(section.at, clear))
}

/** Lo que separa los carteles del personaje sentado, en altos de personaje. */
const SIGNS_GAP = 0.55
/** Al llegar a Contacto, el sitio donde se sienta queda a esta fracción del
 *  ancho de la pantalla por delante. */
const CONTACT_AHEAD = 0.5

/**
 * Dónde acaba la fila de carteles de Contacto, en píxeles del suelo: su borde
 * derecho, pegado a donde se sienta el personaje. La fila crece hacia la
 * izquierda desde ahí.
 *
 * Estuvieron en el `at` de la sección, bajo el árbol. Para sentarse él camina
 * hasta el cantil y el mundo se desplaza con él: en cualquier pantalla, con
 * el personaje sentado los carteles quedaban fuera, a la izquierda, y en el
 * final del recorrido no había ningún enlace a la vista.
 */
export function signsAnchor(viewport: number, charHeight: number): number {
  return SIT_AT * WORLD_LENGTH + viewport * (CLIFF_X / 100) - charHeight * SIGNS_GAP
}

/**
 * Dónde se aterriza al ir a Contacto: con los carteles y el cantil por
 * delante, a media pantalla. No en el `at` de la sección: en un móvil los
 * carteles, que van junto al cantil, quedaban una pantalla más allá. Con
 * tope por detrás, para no llegar con los carteles a medio aparecer.
 */
export function contactLanding(viewport: number): number {
  const section = SECTIONS[SECTIONS.length - 1]
  return Math.max(
    section.at - PANEL_OPEN_AT * 0.85,
    SIT_AT - (viewport * CONTACT_AHEAD) / WORLD_LENGTH,
  )
}
