/**
 * A qué velocidad avanza el mundo mientras se mantiene pulsado un botón de
 * andar, según cuánto lleva pulsado. Sin React, para poder probarlo.
 *
 * Arranca andando y, si se sigue pulsando, echa a correr: un toque corto es
 * un paso, y mantener es cruzar el bioma. Las velocidades van en píxeles de
 * scroll por segundo; las da la página, que sabe cuánto mide la pantalla.
 */
export const WALK_UNTIL = 0.35
export const RUN_FROM = 0.9

export function walkSpeed(heldSeconds: number, walk: number, run: number): number {
  if (heldSeconds <= WALK_UNTIL) return walk
  if (heldSeconds >= RUN_FROM) return run
  const u = (heldSeconds - WALK_UNTIL) / (RUN_FROM - WALK_UNTIL)
  return walk + (run - walk) * u * u * (3 - 2 * u)
}
