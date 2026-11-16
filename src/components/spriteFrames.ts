/**
 * Qué frame toca en el paso `step` de una hoja: primero los `frames` de
 * corrido y, si hay `loop`, después esa lista una y otra vez. Sin bucle se
 * queda en el último.
 *
 * Aparte de `SpriteGrid` para poder probarlo sin navegador.
 */
export function frameAt(step: number, frames: number, loop?: readonly number[]): number {
  if (step < frames) return Math.max(0, step)
  if (!loop || loop.length === 0) return frames - 1
  return loop[(step - frames) % loop.length]
}
