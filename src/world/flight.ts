/**
 * El vuelo con élitros: los tiempos del gesto y la trayectoria. Sin React.
 *
 * Al pulsar un cartel que lleva fuera —LinkedIn, GitHub— el personaje saca un
 * cohete, abre las alas, lo enciende y sale volando; al salir de la pantalla,
 * la página navega al enlace. La hoja (`fly`, de `gen_fly.py`) va dibujada en
 * el sitio y aquí se dice cuánto se desplaza, como en el podio.
 */

/** Poses del despegue y del planeo, en ese orden en la hoja. */
export const TAKE_OFF_FRAMES = 10
export const GLIDE_FRAMES = 10
/** La pose en la que el cohete se enciende. Coincide con `FIRE` del generador. */
export const FIRE_FRAME = 6

/** Lo que dura prepararse y lo que tarda en salir de la pantalla. */
export const PREP_MS = 900
export const FLIGHT_MS = 1400
/** Cada cuánto cambia de pose mientras planea. */
const GLIDE_STEP_MS = 70

/** Dónde está su mano con el cohete al encenderlo, y de dónde sale la estela,
 *  dentro de la celda de 460×600 de la hoja. */
export const FIRE_AT = { x: 350, y: 196 } as const
export const TRAIL_AT = { x: 150, y: 380 } as const

/** La pose que toca a los `ms` de empezar el gesto. */
export function flightFrame(ms: number): number {
  if (ms < PREP_MS) {
    return Math.min(TAKE_OFF_FRAMES - 1, Math.max(0, Math.floor((ms / PREP_MS) * TAKE_OFF_FRAMES)))
  }
  return TAKE_OFF_FRAMES + (Math.floor((ms - PREP_MS) / GLIDE_STEP_MS) % GLIDE_FRAMES)
}

/** Cuánto del vuelo lleva hecho, de 0 a 1. Antes de despegar, 0. */
export const flightProgress = (ms: number) => Math.min(1, Math.max(0, (ms - PREP_MS) / FLIGHT_MS))

/**
 * Cuánto se ha desplazado de su sitio, en píxeles, con el vuelo hecho en `u`.
 * `ahead` y `above` son lo que le falta para salir de la pantalla por la
 * derecha y por arriba: al llegar a 1 ha salido por los dos lados.
 *
 * Arranca despacio y acelera, y sube más deprisa al principio de lo que
 * avanza: despega hacia arriba y luego se va.
 */
export function flightOffset(u: number, ahead: number, above: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, u))
  return { x: t * t * ahead, y: -(0.45 * t + 0.55 * t * t) * above }
}

/** Lo que tarda en ponerse de pie si estaba sentado en el cantil. */
export const STAND_MS = 900

/**
 * La pose de la hoja de sentarse a los `ms` de empezar a levantarse: la hoja
 * al revés, de la última —sentado— a la primera, que es de pie y es donde
 * arranca el despegue.
 */
export function standFrame(ms: number, sitFrames: number, sat = 1): number {
  const done = Math.min(1, Math.max(0, ms / STAND_MS))
  // `sat` es cuánto llevaba sentado (0…1). Si lo pidió a medio sentarse,
  // partir de la última pose era un salto: se sentaba de golpe para levantarse.
  const from = Math.min(1, Math.max(0, sat)) * (sitFrames - 1)
  return Math.round((1 - done) * from)
}
