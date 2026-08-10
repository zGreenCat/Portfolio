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
  /**
   * Por dónde entra. `top` es una caída: nace sobre el cuadro y baja. `side` es
   * viento: nace en el borde derecho a cualquier altura.
   *
   * No es cosmético. Una partícula que deriva a 900 px/s cruza la pantalla en
   * cuatro segundos, y cayendo a 30 px/s tardaría catorce en bajar hasta el
   * cuadro: naciendo arriba, la arena moría fuera de plano sin verse nunca.
   */
  from: 'top' | 'side'
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
    from: 'top',
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
    from: 'side',
    rate: 170,
    size: [2, 4],
    fall: [18, 60],
    drift: [-980, -420],
    sway: 5,
    stretch: 7,
    colors: ['#e8d5a3', '#d9c089', '#f2e4bd'],
    alpha: [0.28, 0.62],
    haze: { color: '226, 200, 140', max: 0.34 },
  },
  petals: {
    from: 'top',
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
  /** Del clima con el que nació, no del activo: en las fronteras conviven dos y
   *  dibujar nieve con el estirado de la arena la volvía rayas. */
  stretch: number
  /** 0 = al fondo, 1 = pegada a la cámara. Escala tamaño, velocidad y opacidad. */
  depth: number
}

export interface WeatherState {
  kind: WeatherKind | null
  /** 0 = nada, 1 = a pleno. Se desvanece cerca de las fronteras de bioma. */
  power: number
}

interface WeatherProps {
  /** Va por ref, no por prop: el clima cambia en cada frame y pasarlo como
   *  estado obligaba a re-renderizar la página entera 60 veces por segundo. */
  stateRef: { current: WeatherState }
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
export default function Weather({ stateRef, worldDeltaRef }: WeatherProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let dpr = 1
    /** El velo se reconstruye solo al cambiar de alto: los topes van en
     *  proporción y la fuerza se aplica con globalAlpha. */
    let veil: CanvasGradient | null = null
    let veilKey = ''
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      veil = null
    }
    resize()
    window.addEventListener('resize', resize)

    let particles: Particle[] = []
    let seeded: WeatherKind | null = null
    let pending = 0
    let last = performance.now()
    let raf = 0

    const between = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo)

    /** `spread` reparte por todo el ancho en vez de por el borde: se usa para
     *  sembrar al entrar en el bioma, que si no la pantalla llega vacía y se va
     *  llenando desde la derecha como una cortina. */
    const spawn = (recipe: Recipe, spread = false): Particle => {
      const depth = 0.25 + Math.random() * 0.75
      const side = recipe.from === 'side'
      return {
        x: spread
          ? Math.random() * (width + 400) - 200
          : side
            ? width + 20 + Math.random() * 280
            : Math.random() * (width + 300) - 150,
        y:
          spread || side
            ? Math.random() * (height + 60) - 30
            : -20 - Math.random() * height * 0.4,
        size: Math.round(between(recipe.size) * depth),
        fall: between(recipe.fall) * depth,
        drift: between(recipe.drift) * depth,
        sway: recipe.sway * depth,
        phase: Math.random() * Math.PI * 2,
        color: recipe.colors[Math.floor(Math.random() * recipe.colors.length)],
        alpha: between(recipe.alpha) * depth,
        stretch: recipe.stretch,
        depth,
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ctx.clearRect(0, 0, width, height)

      const { kind: active, power: strength } = stateRef.current
      const worldDelta = worldDeltaRef.current

      if (active !== seeded) {
        // Cambio de clima: se siembra repartido por el cuadro para que el bioma
        // no se estrene vacío, sobre todo al llegar por perla. Las anteriores NO
        // se borran: se dejan salir solas, o la frontera cortaría en seco.
        seeded = active
        if (active) {
          const recipe = RECIPES[active]
          const room = 1400 - particles.length
          const seeds = Math.min(room, Math.round(((recipe.rate * width) / 1000) * 2.2))
          for (let i = 0; i < seeds; i += 1) particles.push(spawn(recipe, true))
        }
      }

      if (active && strength > 0.01) {
        const recipe = RECIPES[active]
        pending += ((recipe.rate * width) / 1000) * strength * dt
        while (pending >= 1 && particles.length < 1400) {
          particles.push(spawn(recipe))
          pending -= 1
        }
      }

      particles = particles.filter((p) => {
        p.phase += dt * 2
        p.y += p.fall * dt
        // El arrastre del mundo mueve más lo cercano: eso es la profundidad.
        p.x += p.drift * dt + Math.sin(p.phase) * p.sway * dt - worldDelta * p.depth * 0.35
        // El margen derecho tiene que dar cabida al borde de nacimiento lateral.
        return p.y < height + 30 && p.x > -220 && p.x < width + 420
      })

      const recipe = active ? RECIPES[active] : null

      const draw = (p: Particle) => {
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, p.size * p.stretch), p.size)
      }

      // El velo va entre las partículas lejanas y las cercanas: eso es lo que
      // lo hace leer como aire con polvo y no como un filtro encima de todo.
      // Rellenar la pantalla entera cuesta, así que por debajo de un velo
      // imperceptible no se dibuja.
      const haze = recipe?.haze
      const peak = haze ? haze.max * strength : 0
      if (haze && peak > 0.004) {
        particles.forEach((p) => p.depth < 0.55 && draw(p))
        const key = `${haze.color}|${height}`
        if (!veil || veilKey !== key) {
          veil = ctx.createLinearGradient(0, 0, 0, height)
          veil.addColorStop(0, `rgba(${haze.color}, 0.45)`)
          veil.addColorStop(0.55, `rgba(${haze.color}, 1)`)
          veil.addColorStop(1, `rgba(${haze.color}, 0.7)`)
          veilKey = key
        }
        ctx.globalAlpha = peak
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
  }, [stateRef, worldDeltaRef])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
