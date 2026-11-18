/**
 * Llegar al mundo cayendo del cielo, que es como se vuelve de la página de
 * dirección equivocada: allí se tira de la isla del End y aquí aterriza en
 * Inicio. Sin nada de React ni del navegador, para poder probarlo.
 */
import { SEGMENTS, span } from '../components/lostSheet.ts'

/** Lo que tarda en bajar desde fuera de la pantalla. */
export const FALL_MS = 1050
/** El golpe y levantarse: el tramo `land` de la hoja, entero. */
export const LAND_MS = 620
/** Cada pose de agitar los brazos, mientras cae. */
export const FLAIL_MS = 70

/** Adónde llegar tras la 404: al mundo, o al mundo y luego la portada. */
export type Arrival = 'mundo' | 'portada'

/** Donde lo deja anotado la 404, en `sessionStorage`. */
export const ARRIVAL_KEY = 'llegada'

export function readArrival(value: string | null | undefined): Arrival | null {
  return value === 'mundo' || value === 'portada' ? value : null
}

export interface FallPose {
  /** Frame de la hoja `fall`. */
  frame: number
  /** Cuánto le falta por bajar: 1 arriba, fuera de la pantalla; 0 en el suelo. */
  lift: number
  done: boolean
}

/**
 * Dónde está y qué pose tiene a los `ms` de empezar a caer. Baja acelerando,
 * como algo que cae, y al tocar suelo corre el golpe.
 */
export function fallPose(ms: number): FallPose {
  const [fallFrom] = span('fall')
  const [landFrom, landTo] = span('land')
  if (ms < FALL_MS) {
    const t = Math.max(0, ms) / FALL_MS
    return {
      frame: fallFrom + (Math.floor(Math.max(0, ms) / FLAIL_MS) % SEGMENTS.fall),
      lift: 1 - t * t,
      done: false,
    }
  }
  const since = ms - FALL_MS
  if (since < LAND_MS) {
    return {
      frame: Math.min(landTo, landFrom + Math.floor((since / LAND_MS) * SEGMENTS.land)),
      lift: 0,
      done: false,
    }
  }
  return { frame: landTo, lift: 0, done: true }
}
