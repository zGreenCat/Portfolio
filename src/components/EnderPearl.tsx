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
  /** Lado de la perla en pantalla. Lo da el alto del personaje: con un tamaño
   *  fijo, en una pantalla grande era una mota y en un móvil media cabeza. */
  size: number
  /**
   * Sin vuelo: el `/tp` del chat. Un estallido donde está (`from`), el salto,
   * y otro donde reaparece (`to`). Aquí no hay perla que salga de plano para
   * tapar el corte; lo tapa que entre los dos estallidos no hay personaje.
   */
  blink?: boolean
}

const PEARL_SRC = '/textures/ender_pearl.png'
/** Lado del sprite, en sus propios píxeles. */
const TEXELS = 16
const GRAVITY = 2100 // px/s²
const PARTICLES = 110
/** Partículas de portal que suelta por segundo mientras vuela. */
const WAKE_PER_SECOND = 220
/** En un `/tp`: cuándo desaparece y cuándo reaparece, desde que se envía. */
const BLINK_CROSS_MS = 110
const BLINK_LAND_MS = 320

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
    const size = shot.size
    /** Un píxel del sprite en pantalla: las partículas se miden en esto, para
     *  que crezcan con la perla. */
    const texel = size / TEXELS

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

    const burst = (bx: number, by: number): Particle[] =>
      Array.from({ length: PARTICLES }, () => {
        const a = Math.random() * Math.PI * 2
        const sp = 40 + Math.random() * 260
        return {
          x: bx,
          y: by,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 90,
          life: 1,
          size: Math.max(2, Math.round(texel * (1 + Math.floor(Math.random() * 2)))),
        }
      })

    const paint = (dt: number) => {
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
    }

    // La estela: partículas de portal que se quedan atrás y se apagan, como
    // las que deja en el juego. Antes eran copias del propio sprite.
    let wake: Particle[] = []
    let owed = 0

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

        owed += WAKE_PER_SECOND * dt
        while (owed >= 1) {
          owed -= 1
          wake.push({
            x: x + (Math.random() - 0.5) * size * 0.7,
            y: y + (Math.random() - 0.5) * size * 0.7,
            // Heredan un poco del vuelo y se quedan flotando.
            vx: vx * 0.08 + (Math.random() - 0.5) * 40,
            vy: vy * 0.08 + (Math.random() - 0.5) * 40,
            life: 0.6 + Math.random() * 0.4,
            size: Math.max(3, Math.round(texel * (1.5 + Math.random() * 1.5))),
          })
        }
        wake.forEach((p) => {
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.life -= dt * 1.5
        })
        wake = wake.filter((p) => p.life > 0)
        wake.forEach((p) => {
          ctx.globalAlpha = Math.min(1, p.life * 1.8)
          ctx.fillStyle = p.life > 0.45 ? '#e6b3ff' : '#8b3fc4'
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
        })
        ctx.globalAlpha = 1
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size)

        if (stage === 'out' && (y < -size || x > vw + size)) {
          // Fuera de plano: aquí se salta, y nadie ve el corte.
          if (!crossed) {
            crossed = true
            shot.onCross()
          }
          stage = 'in'
          wake = []
          // Reentra por arriba, cayendo hacia el punto de aterrizaje.
          const fall = 0.42
          x = shot.toX - vw * 0.28
          y = -size
          vx = (shot.toX - x) / fall
          vy = (shot.toY - y - 0.5 * GRAVITY * fall * fall) / fall
        } else if (stage === 'in' && y >= shot.toY) {
          stage = 'burst'
          landed = true
          shot.onLand()
          particles = burst(shot.toX, shot.toY)
        }
      } else {
paint(dt)

        if (particles.length === 0) {
          shot.onEnd()
          return
        }
      }

      raf = requestAnimationFrame(draw)
    }

    let burstOut = false
    const blink = (now: number) => {
      if (!burstOut) {
        burstOut = true
        particles = burst(shot.fromX, shot.fromY)
      }
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
      last = now
      ctx.clearRect(0, 0, vw, vh)
      if (!crossed && now - start > BLINK_CROSS_MS) {
        crossed = true
        shot.onCross()
      }
      if (!landed && now - start > BLINK_LAND_MS) {
        landed = true
        particles.push(...burst(shot.toX, shot.toY))
        shot.onLand()
      }
      paint(dt)
      if (landed && particles.length === 0) {
        shot.onEnd()
        return
      }
      raf = requestAnimationFrame(blink)
    }

    // Red de seguridad: si algo se atasca, la navegación sigue igual.
    const failsafe = window.setTimeout(() => {
      if (!crossed) shot.onCross()
      if (!landed) shot.onLand()
      shot.onEnd()
      cancelAnimationFrame(raf)
    }, 3000 + (shot.delayMs ?? 0))

    raf = requestAnimationFrame(shot.blink ? blink : draw)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(failsafe)
    }
  }, [shot])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
