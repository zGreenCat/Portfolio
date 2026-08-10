'use client'

import { useEffect, useRef } from 'react'

import styles from './Weather.module.css'

export type WeatherKind = 'snow' | 'sand' | 'petals'

interface Recipe {
  /** Partículas por segundo a intensidad plena, por cada 1000 px de ancho. */
  rate: number
  size: [number, number]
  /** Velocidad en px/s: caída y deriva lateral. */
  fall: [number, number]
  drift: [number, number]
  /** Amplitud del bamboleo lateral. */
  sway: number
  /** Estirado del píxel en x. Una partícula rápida dibujada como cuadrado
   *  parece un punto suelto; alargada en su dirección lee como movimiento. */
  stretch: number
  colors: string[]
  alpha: [number, number]
  /** Velo de color sobre el mundo. La arena quita visibilidad. */
  haze?: { color: string; max: number }
}

const RECIPES: Record<WeatherKind, Recipe> = {
  // La deriva va siempre hacia el mismo lado: la nieve con viento cae en
  // diagonal, y un rango que cruza el cero la deja cayendo a plomo.
  snow: {
    rate: 62,
    size: [2, 5],
    fall: [55, 120],
    drift: [-135, -62],
    sway: 11,
    stretch: 1,
    colors: ['#ffffff', '#eef4ff', '#dbe6f5'],
    alpha: [0.55, 1],
  },
  // No existe en el juego, así que se construye por lectura: casi horizontal,
  // rápida y con velo. Lo que dice tormenta es la pérdida de visibilidad.
  sand: {
    rate: 115,
    size: [2, 4],
    fall: [14, 46],
    drift: [-520, -230],
    sway: 5,
    stretch: 5,
    colors: ['#e8d5a3', '#d9c089', '#f2e4bd'],
    alpha: [0.28, 0.62],
    haze: { color: '226, 200, 140', max: 0.3 },
  },
  petals: {
    rate: 34,
    size: [3, 7],
    fall: [26, 58],
    drift: [-62, -16],
    sway: 36,
    stretch: 1,
    colors: ['#f6b8d0', '#efa1c2', '#ffd3e4'],
    alpha: [0.65, 1],
  },
}

interface Particle {
  x: number
  y: number
  size: number
  fall: number
  drift: number
  sway: number
  phase: number
  color: string
  alpha: number
  /** 0 = al fondo, 1 = pegada a la cámara. Escala tamaño, velocidad y opacidad. */
  depth: number
}

interface WeatherProps {
  kind: WeatherKind | null
  /** 0 = nada, 1 = a pleno. Se desvanece cerca de las fronteras de bioma. */
  intensity: number
  /** Píxeles de mundo recorridos desde el último frame: arrastra las partículas. */
  worldDeltaRef: { current: number }
}

/**
 * Clima ambiental por bioma, en canvas.
 *
 * Cada partícula lleva una profundidad que escala tamaño, velocidad y opacidad:
 * sin eso la nieve parece una cortina plana en vez de un volumen. Y se arrastran
 * con el avance del mundo, así que el clima pertenece al sitio y no a la
 * pantalla.
 */
export default function Weather({ kind, intensity, worldDeltaRef }: WeatherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const kindRef = useRef(kind)
  const intensityRef = useRef(intensity)
  kindRef.current = kind
  intensityRef.current = intensity

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let particles: Particle[] = []
    let pending = 0
    let last = performance.now()
    let raf = 0

    const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo)

    const spawn = (recipe: Recipe): Particle => {
      const depth = 0.25 + Math.random() * 0.75
      return {
        // Entra por arriba, y también por la derecha si va muy lateral.
        x: Math.random() * (width + 300) - 150,
        y: -20 - Math.random() * height * 0.4,
        size: Math.round(between(recipe.size) * depth),
        fall: between(recipe.fall) * depth,
        drift: between(recipe.drift) * depth,
        sway: recipe.sway * depth,
        phase: Math.random() * Math.PI * 2,
        color: recipe.colors[Math.floor(Math.random() * recipe.colors.length)],
        alpha: between(recipe.alpha) * depth,
        depth,
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, width, height)

      const active = kindRef.current
      const strength = intensityRef.current
      const worldDelta = worldDeltaRef.current

      if (active && strength > 0.01) {
        const recipe = RECIPES[active]
        pending += ((recipe.rate * width) / 1000) * strength * dt
        while (pending >= 1 && particles.length < 900) {
          particles.push(spawn(recipe))
          pending -= 1
        }
      }

      particles = particles.filter((p) => {
        p.phase += dt * 2
        p.y += p.fall * dt
        // El arrastre del mundo mueve más lo cercano: eso es la profundidad.
        p.x += p.drift * dt + Math.sin(p.phase) * p.sway * dt - worldDelta * p.depth * 0.35
        return p.y < height + 30 && p.x > -220 && p.x < width + 220
      })

      const recipe = active ? RECIPES[active] : null
      const stretch = recipe?.stretch ?? 1

      const draw = (p: Particle) => {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, p.size * stretch), p.size)
      }

      // El velo va entre las partículas lejanas y las cercanas: eso es lo que
      // lo hace leer como aire con polvo y no como un filtro encima de todo.
      const haze = recipe?.haze
      if (haze) {
        particles.forEach((p) => p.depth < 0.55 && draw(p))
        const veil = ctx.createLinearGradient(0, 0, 0, height)
        const peak = haze.max * strength
        veil.addColorStop(0, `rgba(${haze.color}, ${peak * 0.45})`)
        veil.addColorStop(0.55, `rgba(${haze.color}, ${peak})`)
        veil.addColorStop(1, `rgba(${haze.color}, ${peak * 0.7})`)
        ctx.globalAlpha = 1
        ctx.fillStyle = veil
        ctx.fillRect(0, 0, width, height)
        particles.forEach((p) => p.depth >= 0.55 && draw(p))
      } else {
        particles.forEach(draw)
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [worldDeltaRef])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
