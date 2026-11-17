/**
 * El podio: dónde está, cuánto dura subir y por dónde salta el personaje.
 * Sin React. Los píxeles de `STAGE` los imprime `scripts/render/world.py`.
 */
import { FRAME_COUNT } from '../components/characterSheets.ts'

/*
 * El podio. Va en la taiga, justo después del cofre, y es lo segundo del
 * recorrido que NO es una posición: como sentarse, es un gesto que corre por
 * tiempo y no escucha la rueda hasta que termina. A diferencia de sentarse, no
 * se dispara solo: se pide con un botón.
 */
/** Dónde se planta para subir. El escenario mide dieciséis bloques y crece
 *  con el alto de la pantalla, mientras que el bioma mide lo mismo en píxeles:
 *  más adelante que esto, en un monitor de 1440 se salía por la frontera con
 *  los cerezos. */
export const PODIUM_AT = 0.46
/** Hueco entre el cofre y el peldaño del estrado, en px del render. Ahí se
 *  planta el personaje: con el cofre a su espalda y el escenario delante. */
export const CHEST_GAP = 190
/** Ancho del cofre en px del render: 14 de los 16 píxeles de un bloque, como
 *  en el juego. Lo imprime `scripts/render/chest.py`. */
export const CHEST_PX = 124
/** La medalla que flota a la entrada del escenario, en px del render. */
export const MEDAL = { width: 88, up: 240 } as const
/** Holgura para dar por llegado al personaje después de pedirlo. Tiene que
 *  ser de píxeles: el mundo se clava donde está al empezar a subir, y lo que
 *  falte por andar es lo que flotaría fuera de la columna. */
export const PODIUM_ZONE = 0.0006
/** Pedirlo desde más cerca que esto no es una caminata: no hay recorrido con
 *  el que acompasar el encuadre. */
export const PODIUM_NEAR = 0.005
/** Si la rueda se mueve esto mientras va de camino, es que ya no quiere ir. */
export const PODIUM_CANCEL = 0.002
/** Y alejarse de verdad para que baje, igual que con `SIT_RELEASE`. */
export const PODIUM_RELEASE = 0.035
/** Lo que dura subir: 32 frames de la hoja `climb`. */
export const PODIUM_SECONDS = 1.6
/** En el podio el personaje se va a la izquierda. El escenario queda a su
 *  derecha y el cajón ocupa el otro 42%: al 20% el primer puesto caía bajo el
 *  velo del cajón. */
export const PODIUM_X = 7
/**
 * Puntos de apoyo del escenario, en píxeles del render. Los imprime
 * `scripts/render/world.py` (ANCHOR) al renderizar `podium_stage`; si cambia
 * la escena hay que volver a copiarlos. `x` cuenta desde donde se planta en el
 * estrado, `up` desde la línea de los pies en el suelo.
 */
export const STAGE = {
  /** Columna del render donde se planta, sobre la alfombra. */
  anchorX: 1287.1,
  /** El estrado: de su peldaño izquierdo a su extremo derecho. */
  from: -274.8,
  to: 1688,
  /** Lo que levanta el estrado: media losa, vista por la cámara. */
  lift: 67.6,
  second: { x: 314.1, up: 353.9 },
  first: { x: 706.7, up: 484.8 },
  /** La bajada hacia delante: el tercer puesto y la alfombra del otro lado. */
  third: { x: 1099.3, up: 288.5 },
  exit: { x: 1413.4, up: 67.6 },
} as const
/** Los dos saltos de `climb`: frames en el aire y altura del arco, en px del
 *  render. Los frames salen de `HOPS` en `scripts/render/gen_podium.py`. */
export const PODIUM_HOPS = [
  { from: 4, to: 10, arc: 92 },
  { from: 13, to: 19, arc: 88 },
] as const
/** Frame de `climb` en el que ya ha caído y empieza a girarse (`LANDED`). */
export const PODIUM_LANDED = 20

export type Spot = { x: number; up: number }
export const PODIUM_WAY_UP: readonly Spot[] = [{ x: 0, up: STAGE.lift }, STAGE.second, STAGE.first]
export const PODIUM_WAY_DOWN: readonly Spot[] = [STAGE.first, STAGE.third, STAGE.exit]

/** Dónde está respecto a su sitio en el estrado, en el frame `frame` de los
 *  saltos, yendo de parada en parada. */
export function hopSpot(frame: number, stops: readonly Spot[]): Spot {
  for (let i = 0; i < PODIUM_HOPS.length; i += 1) {
    const hop = PODIUM_HOPS[i]
    if (frame <= hop.from) return stops[i]
    if (frame < hop.to) {
      const u = (frame - hop.from) / (hop.to - hop.from)
      return {
        x: stops[i].x + (stops[i + 1].x - stops[i].x) * u,
        up: stops[i].up + (stops[i + 1].up - stops[i].up) * u + hop.arc * 4 * u * (1 - u),
      }
    }
  }
  return stops[stops.length - 1]
}

/**
 * Frame de `climb` y sitio en el estrado para un punto `at` del gesto (0→1).
 *
 * Subir y bajar de vuelta son la misma hoja en un sentido y en el otro. Bajar
 * hacia delante no: se gira de nuevo de perfil —el final de la hoja al revés—
 * y luego da los mismos dos saltos hacia delante, ahora al tercer puesto y al
 * suelo. Rebobinar ahí lo devolvía al lado por el que vino justo cuando se iba
 * por el otro.
 */
export function podiumPose(at: number, leavingAhead: boolean): { frame: number; spot: Spot } {
  const last = FRAME_COUNT.climb - 1
  if (!leavingAhead) {
    const frame = at * FRAME_COUNT.climb
    return { frame: Math.min(last, Math.floor(frame)), spot: hopSpot(frame, PODIUM_WAY_UP) }
  }
  const elapsed = (1 - at) * FRAME_COUNT.climb
  const turn = FRAME_COUNT.climb - PODIUM_LANDED
  if (elapsed < turn) return { frame: last - Math.floor(elapsed), spot: STAGE.first }
  const frame = elapsed - turn
  return {
    frame: Math.min(PODIUM_LANDED - 1, Math.floor(frame)),
    spot: hopSpot(frame, PODIUM_WAY_DOWN),
  }
}
