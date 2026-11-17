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

/** Píxeles que la rueda avanza por «línea», cuando el navegador cuenta así. */
const LINE_PX = 40

/**
 * Lo que pide un golpe de rueda, en píxeles. `deltaMode` dice en qué viene:
 * 0 píxeles, 1 líneas (Firefox con ratón), 2 páginas.
 */
export function wheelPixels(delta: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return delta * LINE_PX
  if (deltaMode === 2) return delta * pageHeight
  return delta
}
