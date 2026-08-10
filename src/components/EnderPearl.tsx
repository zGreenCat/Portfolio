'use client'

import { useEffect, useRef } from 'react'

import styles from './EnderPearl.module.css'

export interface PearlThrow {
  /** Desde dónde sale, en píxeles de viewport. */
  fromX: number
  fromY: number
  /** Dónde aterriza en la pantalla de destino. */
  toX: number
  toY: number
  /** Se llama cuando la perla ya salió de pantalla: el momento de saltar. */
  onCross: () => void
  /** Se llama en el impacto, con el destino ya en pantalla. */
  onLand: () => void
  /** Se llama cuando las partículas se han disuelto. */
  onEnd: () => void
  /** Espera antes de que la perla aparezca: el tiempo que tarda la mano en
   *  llegar al frame de suelta. Sin esto la perla sale antes del gesto. */
  delayMs?: number
}

const PEARL_SRC = '/textures/ender_pearl.png'
/** Tamaño en pantalla del sprite de 16×16. Múltiplo entero: 16 × 2. */
const PEARL_PX = 32
const GRAVITY = 2100 // px/s²
const PARTICLES = 110

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
}

/**
 * Perla de ender en dos tramos.
 *
 * El salto de scroll ocurre mientras la perla está **fuera de pantalla**, así
 * que no hay corte que disimular: se lanza en una pantalla y cae en la otra,
 * que es exactamente lo que hace en el juego. Animar el scroll entre secciones
 * sería lento y mareante; así es instantáneo y se percibe como teletransporte.
 */
export default function EnderPearl({ shot }: { shot: PearlThrow | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!shot) return
    const canvas = canvasRef.current
    if (!canvas) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shot.onCross()
      shot.onLand()
      shot.onEnd()
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      shot.onCross()
      shot.onLand()
      shot.onEnd()
      return
    }

    const dpr = Math.min(window.devicePixelRatio, 2)
    const vw = window.innerWidth
    const vh = window.innerHeight
    canvas.width = vw * dpr
    canvas.height = vh * dpr
    ctx.scale(dpr, dpr)
    // Sin esto el sprite de 16 px sale borroso al ampliarlo.
    ctx.imageSmoothingEnabled = false

    const sprite = new Image()
    sprite.src = PEARL_SRC

    // Se retrasa el arranque hasta que la mano llega al frame de suelta.
    const start = performance.now() + (shot.delayMs ?? 0)
    let raf = 0
    let last = start
    let stage: 'out' | 'in' | 'burst' = 'out'
    let crossed = false
    let landed = false
    let particles: Particle[] = []

    // Tramo 1: sale hacia arriba y a la derecha hasta abandonar el cuadro.
    let x = shot.fromX
    let y = shot.fromY
    let vx = vw * 0.85
    let vy = -vh * 1.15

    const trail: { x: number; y: number; life: number }[] = []

    const draw = (now: number) => {
      // Antes de la suelta no se dibuja nada: la mano aún no ha llegado.
      if (now < start) {
        raf = requestAnimationFrame(draw)
        return
      }
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, vw, vh)

      if (stage !== 'burst') {
        x += vx * dt
        y += vy * dt
        vy += GRAVITY * dt

        trail.unshift({ x, y, life: 1 })
        if (trail.length > 7) trail.pop()

        trail.forEach((t, i) => {
          ctx.globalAlpha = 0.34 * (1 - i / trail.length)
          const s = PEARL_PX * (1 - i * 0.09)
          ctx.drawImage(sprite, t.x - s / 2, t.y - s / 2, s, s)
        })
        ctx.globalAlpha = 1
        ctx.drawImage(sprite, x - PEARL_PX / 2, y - PEARL_PX / 2, PEARL_PX, PEARL_PX)

        if (stage === 'out' && (y < -PEARL_PX || x > vw + PEARL_PX)) {
          // Fuera de plano: aquí se salta, y nadie ve el corte.
          if (!crossed) {
            crossed = true
            shot.onCross()
          }
          stage = 'in'
          trail.length = 0
          // Reentra por arriba, cayendo hacia el punto de aterrizaje.
          const fall = 0.42
          x = shot.toX - vw * 0.28
          y = -PEARL_PX
          vx = (shot.toX - x) / fall
          vy = (shot.toY - y - 0.5 * GRAVITY * fall * fall) / fall
        } else if (stage === 'in' && y >= shot.toY) {
          stage = 'burst'
          landed = true
          shot.onLand()
          particles = Array.from({ length: PARTICLES }, () => {
            const a = Math.random() * Math.PI * 2
            const sp = 40 + Math.random() * 260
            return {
              x: shot.toX,
              y: shot.toY,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 90,
              life: 1,
              size: 2 + Math.floor(Math.random() * 4),
            }
          })
        }
      } else {
        particles.forEach((p) => {
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.vy += 380 * dt
          p.life -= dt * 1.5
        })
        particles = particles.filter((p) => p.life > 0)

        particles.forEach((p) => {
          ctx.globalAlpha = Math.max(0, p.life)
          // Partícula de portal: violeta claro que se apaga a morado.
          ctx.fillStyle = p.life > 0.55 ? '#e6b3ff' : '#8b3fc4'
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
        })
        ctx.globalAlpha = 1

        if (particles.length === 0) {
          shot.onEnd()
          return
        }
      }

      raf = requestAnimationFrame(draw)
    }

    // Red de seguridad: si algo se atasca, la navegación sigue igual.
    const failsafe = window.setTimeout(() => {
      if (!crossed) shot.onCross()
      if (!landed) shot.onLand()
      shot.onEnd()
      cancelAnimationFrame(raf)
    }, 3000 + (shot.delayMs ?? 0))

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(failsafe)
    }
  }, [shot])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
