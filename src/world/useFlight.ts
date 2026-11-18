'use client'

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

import { CELL_WIDTH, type CharacterState } from '@/components/Character'
import { play } from '@/lib/sounds'

import {
  FIRE_AT,
  FIRE_FRAME,
  FLIGHT_MS,
  PREP_MS,
  TRAIL_AT,
  flightFrame,
  flightOffset,
  flightProgress,
} from './flight'
import type { WorldRefs } from './useWorldRefs'

interface FlightDeps {
  refs: WorldRefs
  writeFrame: (index: number) => void
  setCharacterState: Dispatch<SetStateAction<CharacterState>>
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  hot: boolean
}

/** Chispas del estallido al encender, y las que suelta por segundo en vuelo. */
const BURST = 46
const TRAIL_PER_SECOND = 280
const SPARK_GRAVITY = 260

/**
 * Irse volando a un enlace de fuera: el gesto, las chispas del cohete y, al
 * salir de la pantalla, la navegación.
 *
 * Navega en esta misma pestaña y al terminar, no al pulsar. En una pestaña
 * nueva el navegador se lleva al visitante en el acto y el vuelo no se ve; y
 * abrirla después del gesto es una ventana emergente, que se bloquea.
 *
 * El personaje no se mueve por la capa del mundo: el bucle le escribe su
 * `transform` en cada frame. El vuelo desplaza el sprite con `translate`, que
 * es otra propiedad y no se pisa.
 */
export function useFlight({ refs, writeFrame, setCharacterState }: FlightDeps) {
  const { spriteRef, stateRef, facingRef, teleportingRef } = refs
  const sparksRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const flyingRef = useRef(false)

  /** Deja al personaje como estaba antes de volar. */
  const land = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    flyingRef.current = false
    teleportingRef.current = false
    const sprite = spriteRef.current
    if (sprite) {
      sprite.style.translate = ''
      sprite.style.opacity = ''
    }
    const canvas = sparksRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    stateRef.current = 'idle'
    setCharacterState('idle')
  }, [setCharacterState, spriteRef, stateRef, teleportingRef])

  // Quien vuelve con «atrás» recupera la página tal como la dejó: con el
  // personaje fuera de la pantalla. Se le devuelve a su sitio.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted && flyingRef.current) land()
    }
    window.addEventListener('pageshow', onShow)
    return () => {
      window.removeEventListener('pageshow', onShow)
      cancelAnimationFrame(rafRef.current)
    }
  }, [land])

  const flyTo = useCallback(
    (href: string): boolean => {
      const sprite = spriteRef.current
      const canvas = sparksRef.current
      const ctx = canvas?.getContext('2d')
      if (!sprite || !canvas || !ctx) return false
      if (flyingRef.current || teleportingRef.current) return false
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

      flyingRef.current = true
      // Como un teletransporte: el bucle no le elige marcha ni lo gira.
      teleportingRef.current = true
      facingRef.current = 1
      sprite.style.transform = ''
      sprite.dataset.driven = 'true'
      stateRef.current = 'fly'
      setCharacterState('fly')

      const density = window.devicePixelRatio || 1
      canvas.width = window.innerWidth * density
      canvas.height = window.innerHeight * density
      ctx.setTransform(density, 0, 0, density, 0, 0)

      // La celda, medida antes de moverlo: de ahí salen la mano, la estela y
      // lo que le falta para salir de la pantalla.
      const cell = sprite.getBoundingClientRect()
      const scale = cell.width / CELL_WIDTH
      const ahead = window.innerWidth - cell.left + cell.width * 0.2
      const above = cell.bottom + cell.height * 0.2
      let sparks: Spark[] = []
      let lit = false
      let owed = 0
      const start = performance.now()
      let last = start

      const step = (now: number) => {
        const ms = Math.max(0, now - start)
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const frame = flightFrame(ms)
        // Solo cuando el nodo ya enseña la hoja de vuelo: el cambio de hoja
        // llega al DOM un frame después de pedirlo.
        if (sprite.dataset.state === 'fly') writeFrame(frame)

        const u = flightProgress(ms)
        const offset = flightOffset(u, ahead, above)
        sprite.style.translate = `${offset.x}px ${offset.y}px`

        if (!lit && ms < PREP_MS && frame >= FIRE_FRAME) {
          lit = true
          play('throw')
          for (let k = 0; k < BURST; k += 1) {
            const angle = Math.random() * Math.PI * 2
            const speed = 60 + Math.random() * 260
            sparks.push({
              x: cell.left + FIRE_AT.x * scale,
              y: cell.top + FIRE_AT.y * scale,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 60,
              age: 0,
              life: 0.35 + Math.random() * 0.45,
              hot: Math.random() < 0.6,
            })
          }
        }
        if (u > 0 && u < 1) {
          owed += TRAIL_PER_SECOND * dt
          for (; owed >= 1; owed -= 1) {
            sparks.push({
              x: cell.left + offset.x + (TRAIL_AT.x + Math.random() * 30) * scale,
              y: cell.top + offset.y + (TRAIL_AT.y + Math.random() * 30) * scale,
              vx: -120 - Math.random() * 160,
              vy: 60 + Math.random() * 120,
              age: 0,
              life: 0.5 + Math.random() * 0.4,
              hot: Math.random() < 0.5,
            })
          }
        }

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
        sparks = sparks.filter((spark) => {
          spark.age += dt
          spark.x += spark.vx * dt
          spark.y += spark.vy * dt
          spark.vy += SPARK_GRAVITY * dt
          return spark.age < spark.life
        })
        for (const spark of sparks) {
          const alpha = 1 - spark.age / spark.life
          ctx.fillStyle = spark.hot ? `rgb(255 236 170 / ${alpha})` : `rgb(255 140 60 / ${alpha})`
          const size = (spark.hot ? 4 : 6) * Math.max(1, scale * 1.6)
          ctx.fillRect(Math.round(spark.x), Math.round(spark.y), size, size)
        }

        if (ms < PREP_MS + FLIGHT_MS) {
          rafRef.current = requestAnimationFrame(step)
          return
        }
        sprite.style.opacity = '0'
        window.location.assign(href)
      }
      rafRef.current = requestAnimationFrame(step)
      return true
    },
    [facingRef, setCharacterState, spriteRef, stateRef, teleportingRef, writeFrame],
  )

  return { flyTo, sparksRef }
}
