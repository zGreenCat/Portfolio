'use client'

import { useCallback, useEffect, useLayoutEffect, type Dispatch, type SetStateAction } from 'react'

import {
  CELL_WIDTH,
  FRAME_COUNT,
  SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from '@/components/Character'
import { loopsByItself } from '@/components/characterSheets'
import { play } from '@/lib/sounds'

import { CHAR_HEIGHT_VH, THROW_MS } from './constants'
import type { WorldRefs } from './useWorldRefs'

interface SpriteDeps {
  refs: WorldRefs
  worldPx: number
  characterState: CharacterState
  setCharacterState: Dispatch<SetStateAction<CharacterState>>
}

/**
 * El frame del personaje: quién lo escribe y cuándo. Devuelve `writeFrame`,
 * que usan el bucle y la entrada, y lleva los dos casos que no son suyos: el
 * reposo, que vuelve al CSS, y el lanzamiento, que tiene su propio reloj.
 */
export function useSprite({ refs, worldPx, characterState, setCharacterState }: SpriteDeps) {
  const { spriteRef, stateRef } = refs

  /**
   * Escribe el frame del sprite sobre el nodo. El ciclo va atado al avance real
   * del mundo, así que cambia en cada frame: como prop, re-renderizaba.
   *
   * La hoja se lee del propio nodo, NO de `stateRef`. El cambio de estado llega
   * al DOM cuando React re-renderiza, un frame más tarde, y en esa ventana las
   * dos fuentes discrepan: `run` mide 367 px de alto en 16 celdas y `walk` 399
   * en 25, así que el ancho de celda no coincide y el corte cae en mitad de un
   * frame. Se veían dos poses a la vez.
   */
  const writeFrame = useCallback(
    (index: number) => {
      const node = spriteRef.current
      const shown = node?.dataset.state as CharacterState | undefined
      if (!node || !shown) return
      const sheet = SHEET_GEOMETRY[shown]
      const width = CELL_WIDTH * ((worldPx * CHAR_HEIGHT_VH) / sheet.charHeight)
      const wrapped = ((index % sheet.frames) + sheet.frames) % sheet.frames
      node.style.backgroundPositionX = `${-wrapped * width}px`
    },
    [worldPx],
  )

  /**
   * En reposo el ciclo vuelve al CSS, y hay que borrar el frame que dejó el
   * bucle. El keyframe solo declara `to`, así que el `from` implícito sale del
   * valor que haya puesto: con el inline viejo, el ciclo arrancaba desalineado.
   */
  useEffect(() => {
    if (loopsByItself(characterState) && spriteRef.current) {
      spriteRef.current.style.backgroundPositionX = ''
    }
  }, [characterState])

  // --- gesto de lanzamiento ---
  // El primer frame se escribe al montar la hoja, antes de pintar. Lanzando en
  // marcha, el nodo traía el desplazamiento de la zancada, y sobre la hoja de
  // lanzar eso era una pose de mitad del gesto durante un frame.
  useLayoutEffect(() => {
    if (characterState === 'throw') writeFrame(0)
  }, [characterState, writeFrame])

  useEffect(() => {
    if (characterState !== 'throw') return
    const t0 = performance.now()
    let raf = 0
    let released = false
    const step = (now: number) => {
      // Nunca negativo: la marca del frame puede ser anterior al momento en
      // que arrancó el efecto, y un tiempo negativo daba el frame -1, que al
      // envolver es el último del gesto. Era el parpadeo al empezar a lanzar.
      const t = Math.max(0, (now - t0) / THROW_MS)
      if (!released && t >= THROW_RELEASE.frame / FRAME_COUNT.throw) {
        released = true
        play('throw')
      }
      if (t >= 1) {
        // Al acabar el gesto vuelve a reposo. Sin esto se quedaba clavado en
        // el último frame del lanzamiento mientras la perla seguía volando.
        stateRef.current = 'idle'
        setCharacterState('idle')
        return
      }
      writeFrame(Math.floor(t * FRAME_COUNT.throw))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [characterState, writeFrame])

  return writeFrame
}
