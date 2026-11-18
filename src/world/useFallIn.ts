'use client'

import { useEffect, useLayoutEffect, type Dispatch, type SetStateAction } from 'react'

import type { CharacterState } from '@/components/Character'

import type { Phase } from './constants'
import { fallPose } from './fallIn'
import type { WorldRefs } from './useWorldRefs'

interface FallInDeps {
  refs: WorldRefs
  phase: Phase
  setPhase: Dispatch<SetStateAction<Phase>>
  writeFrame: (index: number) => void
  setCharacterState: Dispatch<SetStateAction<CharacterState>>
  /** Ya está en el suelo y de pie. */
  onLanded: () => void
}

/** De cuánto más arriba que la pantalla sale, en altos de ventana. */
const FROM_ABOVE = 1.15

/**
 * La fase `falling`: quien viene de la 404 no saluda ni entra andando, cae
 * del cielo donde empieza el recorrido. La hoja va dibujada en el sitio y lo
 * que baja es el contenedor, con `translate`: el `left` y el `transform` son
 * del bucle y de la entrada.
 */
export function useFallIn({ refs, phase, setPhase, writeFrame, setCharacterState, onLanded }: FallInDeps) {
  const { actorRef, stateRef } = refs

  // Arriba antes de pintar: si no, se le ve un frame de pie en el suelo.
  useLayoutEffect(() => {
    if (phase !== 'falling' || !actorRef.current) return
    actorRef.current.style.translate = `0 ${-FROM_ABOVE * 100}vh`
    stateRef.current = 'fall'
    setCharacterState('fall')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'falling') return
    const actor = actorRef.current
    if (!actor) return

    const land = () => {
      actor.style.translate = ''
      stateRef.current = 'idle'
      setCharacterState('idle')
      setPhase('ready')
      onLanded()
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      land()
      return
    }

    let raf = 0
    let t0 = -1
    const step = (now: number) => {
      if (t0 < 0) t0 = now
      const pose = fallPose(now - t0)
      if (pose.done) {
        land()
        return
      }
      actor.style.translate = `0 ${-pose.lift * FROM_ABOVE * 100}vh`
      writeFrame(pose.frame)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // `refs` es un objeto nuevo en cada render; sus refs no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, writeFrame, onLanded])
}
