/**
 * Cuánto se acerca un valor a su destino en un frame de `dt` segundos, dado
 * lo que se acercaría en un frame a 60 Hz.
 *
 * Los suavizados del recorrido eran `valor += (destino - valor) * 0.12` por
 * frame, sin mirar cuánto duraba. A 120 Hz eso son dos pasos donde a 60 hay
 * uno: el mundo seguía al scroll el doble de rápido, y a 30 fps la mitad. Con
 * esto recorre lo mismo en el mismo tiempo, y a 60 Hz da exactamente el número
 * de siempre.
 */
export function easeFor(perFrameAt60: number, dt: number): number {
  return 1 - Math.pow(1 - perFrameAt60, dt * 60)
}
