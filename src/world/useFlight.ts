'use client'

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'

import { CELL_WIDTH, FRAME_COUNT, type CharacterState } from '@/components/Character'
import { play } from '@/lib/sounds'

import {
  FIRE_AT,
  FIRE_FRAME,
  FLIGHT_MS,
  PREP_MS,
  STAND_MS,
  TRAIL_AT,
  flightFrame,
  flightOffset,
  flightProgress,
  standFrame,
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
/** Lo que se espera a que la página se vaya antes de darlo por perdido. Con
 *  holgura: en una red lenta el destino tarda en cargar y esta sigue a la
 *  vista mientras tanto. */
const STRANDED_MS = 4000

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
  const { spriteRef, stateRef, facingRef, teleportingRef, sitRef } = refs
  const sparksRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const flyingRef = useRef(false)
  /** Ya salió volando y se pidió la navegación: desde aquí, si la página
   *  sigue viva o vuelve a verse, hay que devolverlo. */
  const leftRef = useRef(false)
  const backTimerRef = useRef(0)

  /** Deja al personaje como estaba antes de volar. */
  const land = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    window.clearTimeout(backTimerRef.current)
    flyingRef.current = false
    leftRef.current = false
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

  // Quien vuelve recupera la página tal como la dejó: con el personaje fuera
  // de la pantalla, las chispas congeladas y el mundo sin responder. Se le
  // devuelve a su sitio.
  //
  // No basta con `pageshow` y su `persisted`, que es el «atrás» de un
  // navegador de escritorio. En un móvil el enlace de LinkedIn o de GitHub lo
  // abre su aplicación: esta página no llega a irse, solo deja de verse, y al
  // volver no hay `pageshow` que valga. Así se quedaba para siempre. Por eso
  // también cuenta volver a ser visible, y recuperar el foco.
  useEffect(() => {
    const back = () => {
      if (leftRef.current && document.visibilityState === 'visible') land()
    }
    window.addEventListener('pageshow', back)
    window.addEventListener('focus', back)
    document.addEventListener('visibilitychange', back)
    return () => {
      window.removeEventListener('pageshow', back)
      window.removeEventListener('focus', back)
      document.removeEventListener('visibilitychange', back)
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(backTimerRef.current)
    }
  }, [land])

  const flyTo = useCallback(
    (href: string): boolean => {
      const sprite = spriteRef.current
      const canvas = sparksRef.current
      const ctx = canvas?.getContext('2d')
      // Ya va volando hacia un enlace: este clic queda atendido. Devolvía
      // `false`, el cartel dejaba pasar el enlace y un doble clic lo abría
      // dos veces: una pestaña nueva en el acto y esta al acabar el vuelo.
      if (flyingRef.current) return true
      if (!sprite || !canvas || !ctx) return false
      if (teleportingRef.current) return false
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

      flyingRef.current = true
      // Como un teletransporte: el bucle no le elige marcha ni lo gira.
      teleportingRef.current = true
      facingRef.current = 1
      sprite.style.transform = ''
      sprite.dataset.driven = 'true'
      // Para el bucle ya está volando, y deja de escribirle el frame. Lo que
      // enseña el nodo lo decide el estado de React, más abajo.
      stateRef.current = 'fly'
      // Sentado en el cantil —que es donde quedan los carteles— primero se
      // pone de pie: la hoja de sentarse, al revés. Saltar de sentado a la
      // primera pose del despegue era un corte.
      const seated = sitRef.current > 0 && sprite.dataset.state === 'sit'
      /** Cuánto llevaba sentado al pedirlo: a medio gesto se levanta desde
       *  ahí, no desde sentado del todo. */
      const sat = Math.min(1, sitRef.current)
      if (!seated) setCharacterState('fly')

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
      const begun = performance.now()
      const start = begun + (seated ? STAND_MS : 0)
      let last = begun
      let stood = !seated

      const step = (now: number) => {
        if (!stood) {
          if (now < start) {
            writeFrame(standFrame(now - begun, FRAME_COUNT.sit, sat))
            rafRef.current = requestAnimationFrame(step)
            return
          }
          stood = true
          last = now
          setCharacterState('fly')
        }
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
        leftRef.current = true
        window.location.assign(href)
        // Y si la página no llega ni a ocultarse —el enlace no fue a ningún
        // sitio, o lo abrió otra cosa sin taparla—, vuelve solo.
        backTimerRef.current = window.setTimeout(() => {
          if (leftRef.current && document.visibilityState === 'visible') land()
        }, STRANDED_MS)
      }
      rafRef.current = requestAnimationFrame(step)
      return true
    },
    [facingRef, setCharacterState, sitRef, spriteRef, stateRef, teleportingRef, writeFrame],
  )

  return { flyTo, sparksRef }
}
