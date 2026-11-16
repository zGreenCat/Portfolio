'use client'

import { useEffect, useRef, useState } from 'react'

import styles from './PerfMeter.module.css'

/** Ventana sobre la que se promedia, en ms. */
const WINDOW_MS = 2000
/** Un frame por encima de esto se nota como tirón a 60 Hz. */
const SLOW_MS = 25

function renderer(): string {
  const gl = document.createElement('canvas').getContext('webgl')
  const info = gl?.getExtension('WEBGL_debug_renderer_info')
  if (!gl || !info) return 'desconocida'
  return String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
}

/**
 * Medidor de rendimiento, para diagnosticar en el equipo de quien lo sufre.
 * Solo se monta con `?fps` en la URL.
 *
 * Existe porque el rendimiento de este sitio depende casi por entero de la
 * gráfica —los filtros de las capas van gratis con ella y se llevan todo sin
 * ella— y eso no se puede medir desde otra máquina.
 *
 * Lleva su propio `requestAnimationFrame` y escribe el texto por ref dos veces
 * por segundo: un medidor que re-renderiza por frame mide su propio coste.
 */
export default function PerfMeter() {
  const outRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const gpu = renderer()
    const frames: { at: number; took: number }[] = []
    let last = performance.now()
    let wrote = 0
    let raf = 0

    const tick = (now: number) => {
      frames.push({ at: now, took: now - last })
      last = now
      while (frames.length > 0 && now - frames[0].at > WINDOW_MS) frames.shift()

      if (now - wrote > 500 && outRef.current) {
        wrote = now
        const total = frames.reduce((sum, frame) => sum + frame.took, 0)
        const worst = frames.reduce((max, frame) => Math.max(max, frame.took), 0)
        const slow = frames.filter((frame) => frame.took > SLOW_MS).length
        const lite = document.querySelector('[data-lite="true"]') !== null
        outRef.current.textContent = [
          `fps      ${(1000 / (total / frames.length)).toFixed(0)}`,
          `peor     ${worst.toFixed(0)} ms`,
          `tirones  ${Math.round((100 * slow) / frames.length)} %`,
          `ligero   ${lite ? 'sí' : 'no'}`,
          `ventana  ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
          `gráfica  ${gpu}`,
        ].join('\n')
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const copy = async () => {
    const text = outRef.current?.textContent
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <aside className={styles.meter} aria-label="Medidor de rendimiento">
      <pre ref={outRef} className={styles.out}>
        midiendo…
      </pre>
      <button type="button" className={styles.copy} onClick={copy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </aside>
  )
}
