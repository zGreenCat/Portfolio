/**
 * Los dos gestos que no son una posición: sentarse en el acantilado y subir
 * al podio. Corren por tiempo. Sin React: el bucle de la página guarda su
 * estado, llama aquí en cada frame y se encarga de lo que tocan fuera
 * (congelar el mundo, mover el scroll).
 */
import {
  PODIUM_AT,
  PODIUM_CANCEL,
  PODIUM_RELEASE,
  PODIUM_SECONDS,
  PODIUM_ZONE,
} from './podium.ts'
import { SIT_AT, SIT_RELEASE, SIT_SECONDS } from './constants.ts'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export interface Sit {
  /** Cuánto del gesto lleva hecho: 0 de pie, 1 sentado. */
  at: number
  /** Hacia dónde va: 1 sentándose, -1 levantándose. */
  dir: number
  want: boolean
}

/**
 * Sentarse y levantarse son dos gestos, no un control continuo, y sus
 * condiciones son asimétricas a propósito:
 *
 *   sentarse   depende de haber LLEGADO   → mira `current`
 *   levantarse depende de que te hayas IDO → mira `target`
 *
 * Mirar `target` para sentarse lo disparaba al tocar fondo el scroll, antes
 * de que el personaje llegara al borde. Y mirar `current` para levantarse no
 * funciona porque con el mundo congelado deja de moverse.
 *
 * El orden importa: sentado, `current >= SIT_AT` es cierto siempre, así que
 * la condición de levantarse tiene que evaluarse primero.
 */
export function stepSit(sit: Sit, current: number, target: number, dt: number): Sit {
  let want = sit.want
  if (target < SIT_RELEASE) want = false
  else if (current >= SIT_AT) want = true
  // El sentido solo se replantea con el gesto en reposo —en 0 o en 1—, así
  // que a media animación se termina lo empezado en vez de darse la vuelta.
  const dir = sit.at === 0 || sit.at === 1 ? (want ? 1 : -1) : sit.dir
  return { at: clamp01(sit.at + (dir * dt) / SIT_SECONDS), dir, want }
}

export interface Climb {
  /** Cuánto del gesto lleva hecho: 0 abajo, 1 en el primer puesto. */
  at: number
  dir: number
  want: boolean
  /** Se pidió subir y va de camino. */
  ask: boolean
  /** Baja por delante, por el tercer puesto, en vez de por donde subió. */
  ahead: boolean
}

interface ClimbInput {
  current: number
  target: number
  /** Cuánto se ha corrido ya el encuadre hacia el podio, de 0 a 1. */
  focus: number
  dt: number
}

/**
 * Subir al podio sigue la regla de sentarse, con una diferencia: no se
 * dispara por llegar, se pide. Hubo una versión que subía al detenerse
 * delante, y la zona eran 84 px de scroll: con la perla se acertaba siempre y
 * con la rueda casi nunca, así que una vez abajo no había forma de volver.
 *
 * Además del estado nuevo dice dos cosas que el bucle tiene que atender:
 * `arrived`, que llegó andando y el mundo se clava en el sitio exacto, y
 * `landedAhead`, que acaba de tocar suelo por el otro lado.
 */
export function stepClimb(
  climb: Climb,
  { current, target, focus, dt }: ClimbInput,
): { climb: Climb; arrived: boolean; landedAhead: boolean; leavingAhead: boolean } {
  let { want, ask, dir, ahead } = climb
  let arrived = false
  const fromPodium = Math.abs(target - PODIUM_AT)
  if (fromPodium > PODIUM_RELEASE) want = false
  if (fromPodium > PODIUM_CANCEL) ask = false
  else if (ask && Math.abs(current - PODIUM_AT) < PODIUM_ZONE && focus > 0.97) {
    // Llegó andando. El mundo se clava en el sitio exacto, no donde lo dejó
    // el suavizado: de eso depende que caiga sobre la columna.
    ask = false
    want = true
    arrived = true
  }
  if (climb.at === 0 || climb.at === 1) {
    dir = want ? 1 : -1
    // Por dónde baja se decide arriba y no se cambia a medio salto.
    ahead = climb.at === 1 && target > PODIUM_AT
  }
  const wasUp = climb.at > 0
  const at = clamp01(climb.at + (dir * dt) / PODIUM_SECONDS)
  const leavingAhead = dir < 0 && ahead
  return {
    climb: { at, dir, want, ask, ahead },
    arrived,
    landedAhead: wasUp && at === 0 && leavingAhead,
    leavingAhead,
  }
}
