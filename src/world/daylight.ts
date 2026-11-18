/**
 * Qué hora es en el mundo, según por dónde vas y el tema elegido. Sin React.
 *
 * La hora es un solo número, de 0 (pleno día) a 1 (noche cerrada), y de él
 * cuelgan el cielo, las estrellas, lo que se oscurece el terreno y la luz del
 * farol. Por eso el tema oscuro no pinta nada: recorre la misma escala al
 * revés.
 *
 * - Claro: de día casi todo el recorrido, y anochece hacia el acantilado.
 * - Oscuro: de noche casi todo el recorrido, y amanece hacia el acantilado.
 *   No llega a pleno día: se queda en el punto del atardecer, que con el sol
 *   saliendo es un amanecer.
 */
import { DUSK_FROM, NIGHT_AT } from './constants.ts'

export type Theme = 'light' | 'dark'

/** La hora a la que amanece en el tema oscuro: la del cielo anaranjado. */
export const DAWN = 0.4

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Cuánto se ha entrado en el último tramo del recorrido, de 0 a 1. */
const late = (at: number) => clamp01((at - DUSK_FROM) / (NIGHT_AT - DUSK_FROM))

export function nightAt(at: number, theme: Theme): number {
  return theme === 'dark' ? 1 - late(at) * (1 - DAWN) : late(at)
}

/**
 * Cuánto ha salido el sol, de 0 a 1. Solo sale en el tema oscuro, al final:
 * en el claro el día no tiene sol dibujado, y de noche hay luna.
 */
export function sunAt(night: number, theme: Theme): number {
  return theme === 'dark' ? clamp01((SUN_FROM - night) / (SUN_FROM - DAWN)) : 0
}

/** La hora a la que asoma el sol: con el cielo ya clareando, no antes. */
const SUN_FROM = 0.78
/** Dónde del recorrido se pone la luna, en el tema oscuro. */
export const MOONSET = 0.8
/** Lo que recorre la luna hasta ponerse: de lado, en anchos de pantalla, y
 *  hacia abajo, en altos. */
const MOON_ACROSS = 0.62
const MOON_DOWN = 0.62

/**
 * Cuánto se aparta la luna de su sitio de siempre —arriba a la derecha—, en
 * fracciones del ancho y del alto de la pantalla.
 *
 * En el tema oscuro cruza el cielo mientras se camina: sale alta a la
 * izquierda y se pone tras los cerros de la derecha poco antes del acantilado,
 * que es cuando sale el sol. Quieta toda la noche y desapareciendo de golpe al
 * final se leía como un fallo. En el claro solo se ve al anochecer, y ahí no
 * se mueve.
 */
export function moonAt(at: number, theme: Theme): { x: number; y: number } {
  if (theme !== 'dark') return { x: 0, y: 0 }
  const gone = clamp01(at / MOONSET)
  // Baja despacio al principio y deprisa al final, como un arco.
  return { x: -(1 - gone) * MOON_ACROSS, y: gone * gone * MOON_DOWN }
}

const STORAGE_KEY = 'tema'

/** El tema guardado en este navegador. Claro si no hay ninguno: es como se
 *  diseñó el sitio, y no sigue al sistema a propósito. */
export function storedTheme(read: (key: string) => string | null): Theme {
  try {
    return read(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function storeTheme(theme: Theme, write: (key: string, value: string) => void): void {
  try {
    write(STORAGE_KEY, theme)
  } catch {
    // Sin almacenamiento (modo privado, bloqueado) el tema vale para esta visita.
  }
}
