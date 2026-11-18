/**
 * Qué clima toca y con cuánta fuerza, según el bioma que pisas y lo cerca que
 * estás del siguiente. Sin React.
 */
import type { WeatherKind } from '../components/Weather'
import { SECTIONS } from './constants.ts'

const weatherOf = (index: number): WeatherKind | null => {
  const section = SECTIONS[index]
  return 'weather' in section ? section.weather : null
}

/**
 * El clima se desvanece cerca de la frontera en vez de cortarse: nieve que
 * para en una línea vertical se lee como un fallo. `blend` es cuánto has
 * entrado en el bioma siguiente, de 0 a 1: en la primera mitad se apaga el
 * propio y en la segunda se enciende el que viene.
 */
export function airAt(
  index: number,
  next: number,
  blend: number,
): { kind: WeatherKind | null; power: number } {
  const own = weatherOf(index)
  const upcoming = weatherOf(next)
  if (blend > 0.5 && upcoming) return { kind: upcoming, power: (blend - 0.5) * 2 }
  if (own) return { kind: own, power: Math.max(0, 1 - blend * 2) }
  return { kind: upcoming, power: upcoming ? Math.max(0, blend * 2 - 1) : 0 }
}

/**
 * Rachas. La tormenta sube y baja en vez de quedarse plana, y en las calmas
 * asoma el templo del fondo: taparlo siempre o no taparlo nunca eran las dos
 * malas respuestas.
 *
 * Dos senos de periodo inconmensurable, así no se oye el bucle. Multiplica la
 * fuerza, con lo que arrastra a la vez partículas, velo y visibilidad del
 * fondo: si solo pulsara una de las tres, se notaría el truco.
 */
export function gust(now: number): number {
  const wave = 0.6 * Math.sin(now / 3200) + 0.4 * Math.sin(now / 7900 + 1.7)
  return 0.45 + 0.55 * (wave * 0.5 + 0.5)
}
