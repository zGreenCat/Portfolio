'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { FRAME_COUNT, type CharacterState } from '@/components/Character'
import { BLOCK_PX_SOURCE, WORLD_UNIT } from '@/content/layers'

import {
  CHAR_FEET_VH,
  ENTRY_FROM,
  ENTRY_SECONDS,
  ENTRY_TO,
  LAYER_SPEED,
  NIGHT_STEPS,
  STRIDE,
  WORLD_LENGTH,
  type Phase,
} from './constants'
import { moonAt, nightAt } from './daylight'
import { biomeAt, quantize } from './geometry'
import type { WorldRefs } from './useWorldRefs'

interface PlacementDeps {
  refs: WorldRefs
  phase: Phase
  setPhase: Dispatch<SetStateAction<Phase>>
  worldPx: number
  viewW: number
  half: boolean
  mounted: number[]
  writeFrame: (index: number) => void
  setCharacterState: Dispatch<SetStateAction<CharacterState>>
}

/**
 * Colocar el mundo en una posición: capas, recortes de bioma, pies y hora del
 * día. Es el ÚNICO sitio donde se calcula; lo comparten el bucle y la entrada,
 * y ya dio problemas por estar duplicado. Lleva también la entrada caminando,
 * que coloca el mundo antes de dar el primer paso.
 */
export function usePlacement({
  refs,
  phase,
  setPhase,
  worldPx,
  viewW,
  half,
  mounted,
  writeFrame,
  setCharacterState,
}: PlacementDeps) {
  const {
    actorRef,
    farRef,
    feetVhRef,
    groundRef,
    markersRef,
    midRef,
    nearRef,
    propsRef,
    resumeRef,
    rootRef,
    stateRef,
    stripsRef,
    themeRef,
    worldAtRef,
  } = refs
  /** La noche va cuantizada: cambiarla mueve un `filter` CSS sobre superficies
   *  del ancho del mundo, y re-filtrar eso en cada frame era carísimo. */
  const [night, setNight] = useState(0)
  const moonRef = useRef('')

  // Releer la geometría de las tiras montadas. El recorte se reescribe en cada
  // frame y consultar el DOM ahí dentro sería absurdo.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-strip]'))
    stripsRef.current = nodes.map((el) => ({
      el,
      from: Number(el.dataset.from),
      to: Number(el.dataset.to),
      speed: Number(el.dataset.speed),
      left: Number(el.dataset.left),
      width: Number(el.dataset.width),
    }))
  }, [mounted, half, worldPx, viewW, phase])

  /**
   * Coloca el mundo en una posición: desplazamiento de capas, recorte de cada
   * bioma, altura de los pies y hora del día.
   *
   * Lo comparten el bucle y el reaterrizaje al volver. Antes esto solo existía
   * dentro del bucle, y como el bucle no arranca hasta `ready`, quien volvía
   * veía el bioma inicial durante toda la caminata de entrada y un cambio de
   * fondo de golpe al terminar.
   */
  const placeWorld = useCallback(
    (at: number) => {
      worldAtRef.current = at
      const worldX = at * WORLD_LENGTH
      const nodes: [HTMLDivElement | null, number][] = [
        [farRef.current, LAYER_SPEED.far],
        [midRef.current, LAYER_SPEED.mid],
        [nearRef.current, LAYER_SPEED.near],
        [groundRef.current, LAYER_SPEED.ground],
        [propsRef.current, LAYER_SPEED.ground],
        [markersRef.current, LAYER_SPEED.ground],
      ]
      nodes.forEach(([node, speed]) => {
        if (node) node.style.transform = `translate3d(${-worldX * speed}px,0,0)`
      })

      // El término (1-speed) hace que la frontera caiga en la MISMA x de
      // pantalla en todas las capas pese a que cada una corre a su ritmo. Sin
      // él, el fondo cortaba el bioma mucho antes que el suelo.
      stripsRef.current.forEach((strip) => {
        const shift = worldX * (1 - strip.speed)
        const right = Math.max(0, strip.width - (strip.to - shift - strip.left))
        const inset = Math.max(0, strip.from - shift - strip.left)
        strip.el.style.clipPath = `inset(0 ${right}px 0 ${inset}px)`
      })

      const spot = biomeAt(at)
      // Ya no depende del bioma: la importación recorta cada capa a la misma
      // distancia bajo su superficie, así que el suelo cae siempre a la misma
      // altura de pantalla y cruzar de bioma no da un escalón.
      const feet = CHAR_FEET_VH
      feetVhRef.current = feet
      rootRef.current?.style.setProperty('--char-feet', `${feet * worldPx}px`)

      setNight(quantize(nightAt(at, themeRef.current), NIGHT_STEPS))
      // La luna cruza el cielo con el recorrido. Va cuantizada y solo se
      // escribe al cambiar: es una variable en la raíz.
      const moon = moonAt(at, themeRef.current)
      const moonKey = `${Math.round(moon.x * 400)},${Math.round(moon.y * 400)}`
      if (moonKey !== moonRef.current) {
        moonRef.current = moonKey
        rootRef.current?.style.setProperty('--moon-x', `${(moon.x * 100).toFixed(2)}vw`)
        rootRef.current?.style.setProperty('--moon-y', `${(moon.y * 100).toFixed(2)}vh`)
      }
      return spot
    },
    [worldPx],
  )

  // --- entrada al mundo ---
  useEffect(() => {
    if (phase !== 'entering') return
    const actor = actorRef.current
    if (!actor) return

    // Colocar el mundo ANTES de la caminata: quien vuelve tiene que entrar ya
    // en su bioma, no verse trasladado al acabar de andar.
    if (resumeRef.current !== null) placeWorld(resumeRef.current)

    stateRef.current = 'walk'
    setCharacterState('walk')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      actor.style.left = `${ENTRY_TO}%`
      setPhase('ready')
      return
    }

    const distance = ((ENTRY_TO - ENTRY_FROM) / 100) * window.innerWidth
    const stride = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT) * STRIDE.walk
    const t0 = performance.now()
    let raf = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / (ENTRY_SECONDS * 1000))
      const eased = 1 - (1 - t) ** 3
      actor.style.left = `${ENTRY_FROM + (ENTRY_TO - ENTRY_FROM) * eased}%`
      writeFrame(Math.floor(((eased * distance) / stride) * FRAME_COUNT.walk))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        stateRef.current = 'idle'
        setCharacterState('idle')
        setPhase('ready')
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, worldPx, writeFrame, placeWorld])

  return { placeWorld, night }
}
