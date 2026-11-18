'use client'

import { useEffect, useState } from 'react'

import { STATES, sheetSrc } from '@/components/characterSheets'

import {
  HALF_RES_WIDTH,
  MAX_LOADING_MS,
  MIN_LOADING_MS,
  PRELOAD,
  SECTIONS,
  peekSrc,
  wantsHalfLayers,
  wantsHalfSprites,
} from './constants'
import { layerSrc } from './geometry'

function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () => resolve()
    image.src = src
  })
}

/**
 * La pantalla de carga: espera el primer bioma, el saludo y las hojas de
 * arranque, y avisa una sola vez con `onLoaded`. Devuelve el avance, de 0 a 1.
 *
 * `onLoaded` tiene que ser estable: si cambia de identidad, la carga vuelve a
 * empezar.
 */
export function useWorldLoading(onLoaded: () => void): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    const t0 = performance.now()
    let done = 0
    // La carga sale por dos puertas —todas las imágenes, o el tope de tiempo— y
    // solo puede salir por una: la segunda volvería a armar el reaterrizaje
    // cuando el bucle ya lo consumió.
    let settled = false

    const enter = () => {
      if (cancelled) return
      window.setTimeout(
        () => {
          if (cancelled || settled) return
          settled = true
          window.clearTimeout(cap)
          // Quien vuelve ya te vio saludar. La entrada caminando y el reposo sí
          // se quedan: son lo que planta al personaje en el suelo.
          onLoaded()
        },
        Math.max(0, MIN_LOADING_MS - (performance.now() - t0)),
      )
    }

    // Todo se pide ya en el tamaño que se va a enseñar: aquí aún no hay
    // estado `half`, así que se mira la ventana directamente. Las capas del
    // primer bioma se pedían siempre enteras, y quien iba a ver las medias
    // bajaba las dos.
    const halfLayers = wantsHalfLayers()
    const halfSprites = wantsHalfSprites()
    const wanted = [
      peekSrc(window.innerWidth < HALF_RES_WIDTH),
      ...PRELOAD.map((src) =>
        (src.startsWith('/layers/') ? halfLayers : halfSprites)
          ? src.replace('.webp', '@half.webp')
          : src,
      ),
    ]
    wanted.forEach((src) => {
      void preload(src).then(() => {
        done += 1
        if (!cancelled) setProgress(done / wanted.length)
        if (done === wanted.length) enter()
      })
    })

    const cap: number = window.setTimeout(() => {
      if (cancelled || settled) return
      settled = true
      onLoaded()
    }, MAX_LOADING_MS)

    return () => {
      cancelled = true
      window.clearTimeout(cap)
    }
  }, [onLoaded])

  return progress
}

/**
 * Los bytes de todas las capas, en segundo plano y sin descomprimir. Cuando
 * un bioma se monta ya no hay red de por medio: queda solo el decode, y de
 * adelantarlo se encarga el precalentado del bucle. De ahí que la pantalla de
 * carga siga siendo corta pese a que el mundo pesa 8 MB.
 */
export function useBackgroundFetch(active: boolean, half: boolean, spriteHalf: boolean) {
  useEffect(() => {
    if (!active) return
    let stop = false
    // Las hojas que no bloquean la carga pero sí hacen falta luego: sin esto,
    // `sit` se descarga justo al llegar al acantilado y se nota.
    const rest = [
      ...STATES.map((state) => sheetSrc(state, spriteHalf)),
      layerSrc('b2', 'stage', half),
      ...SECTIONS.flatMap((section) =>
        section.kinds.map((kind) => layerSrc(section.biome, kind, half)),
      ),
    ].filter((src) => !PRELOAD.includes(src))

    const pull = async () => {
      for (const src of rest) {
        if (stop) return
        await fetch(src, { cache: 'force-cache' }).catch(() => {})
      }
    }
    void pull()
    return () => {
      stop = true
    }
  }, [active, half, spriteHalf])
}
