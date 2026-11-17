/**
 * La marcha: si corre, camina o está parado, y por dónde va la zancada. Sin
 * React: el bucle de la página le da la velocidad de cada frame y escribe lo
 * que salga. El porqué de cada umbral está junto a su constante.
 */
import { FRAME_COUNT, type CharacterState } from '../components/characterSheets.ts'
import {
  GAIT_HOLD_SECONDS,
  IDLE_SECONDS,
  MAX_SHEET_FPS,
  MIN_CADENCE,
  PACE_SECONDS,
  SPEED_RUN,
  SPEED_RUN_OFF,
  SPEED_WALK,
  STRIDE,
} from './constants.ts'

/** La velocidad suavizada con la que se elige la marcha. */
export const easePace = (pace: number, speed: number, dt: number) =>
  pace + (speed - pace) * (1 - Math.exp(-dt / PACE_SECONDS))

/** Tiempo seguido por debajo del umbral de caminar. */
export const stillTime = (stillFor: number, speed: number, dt: number) =>
  speed <= SPEED_WALK ? stillFor + dt : 0

interface GaitInput {
  /** La hoja que lleva ahora. */
  now: CharacterState
  /** Bloques por segundo en este frame, y suavizados. */
  speed: number
  pace: number
  stillFor: number
  /** Segundos que lleva la marcha actual. */
  held: number
}

/**
 * La marcha que toca. `state` es `null` si se queda como está. Devuelve
 * también cuánto lleva la marcha: cambiar la pone a cero, y parar la da por
 * asentada para que al arrancar no haya que esperar.
 */
export function pickGait({ now, speed, pace, stillFor, held }: GaitInput): {
  state: 'run' | 'walk' | 'idle' | null
  held: number
} {
  if (stillFor >= IDLE_SECONDS) return { state: 'idle', held: GAIT_HOLD_SECONDS }
  if (speed > SPEED_WALK) {
    // Desde parado se arranca en la marcha que toque. En marcha, solo se
    // cambia pasado el margen y con la anterior ya asentada. Y para echar a
    // correr tiene que seguir yendo rápido ahora mismo: tras un golpe suelto
    // la media sigue alta cuando el mundo ya está frenando, y arrancaba a
    // correr para pararse al instante.
    const moving = now === 'run' || now === 'walk'
    const running = now === 'run'
    const wantsRun = running ? pace > SPEED_RUN_OFF : pace > SPEED_RUN && speed > SPEED_RUN
    if (!moving) return { state: pace > SPEED_RUN ? 'run' : 'walk', held: 0 }
    if (wantsRun !== running && held >= GAIT_HOLD_SECONDS) {
      return { state: wantsRun ? 'run' : 'walk', held: 0 }
    }
  }
  return { state: null, held }
}

/**
 * Avanza la zancada, en ciclos (0…1). Sale del suelo recorrido, y cada marcha
 * cubre lo suyo: `block` son los píxeles de un bloque y `travelled` los que
 * avanzó el mundo en este frame.
 *
 * Acotado por los dos lados: con tope para que no se dispare en un golpe
 * fuerte, y con un mínimo para que al frenar termine el paso en vez de
 * congelarse. En valor absoluto: el ciclo siempre corre hacia delante. Con el
 * signo, retroceder lo reproducía al revés y el personaje caminaba de espaldas.
 */
export function advanceCycle(
  cycle: number,
  active: CharacterState,
  travelled: number,
  block: number,
  dt: number,
): number {
  const stride = block * STRIDE[active]
  const wanted = (Math.abs(travelled) / stride) * FRAME_COUNT[active]
  const cap = MAX_SHEET_FPS * dt
  const floor = (MIN_CADENCE[active] ?? 0) * dt
  return (cycle + Math.max(floor, Math.min(cap, wanted) / FRAME_COUNT[active])) % 1
}
