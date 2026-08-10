import type { CSSProperties } from 'react'

import styles from './NightSky.module.css'

/** Paletas de cielo. Se interpola entre ellas según avanza el recorrido. */
const DAY = { top: [0x3f, 0x7c, 0xb8], mid: [0x7f, 0xb0, 0xda], bottom: [0xb3, 0xd5, 0xec] }
const DUSK = { top: [0x2a, 0x3c, 0x76], mid: [0x8a, 0x5c, 0x8e], bottom: [0xe0, 0x92, 0x63] }
const NIGHT = { top: [0x04, 0x06, 0x0f], mid: [0x0b, 0x12, 0x28], bottom: [0x1b, 0x2a, 0x45] }

const STAR_COUNT = 150

interface NightSkyProps {
  /** 0 = pleno día, 1 = noche cerrada. */
  night: number
}

function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

/** Hash estable: con Math.random el servidor y el cliente no coincidirían. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => {
  const size = 2 + Math.floor(rand(i * 3.7) * 3)
  return {
    left: rand(i * 1.3) * 100,
    // Ninguna por debajo del 62%: ahí abajo está el terreno y no se verían.
    top: rand(i * 2.1) * 62,
    size,
    // Las grandes brillan más, como en el cielo real.
    alpha: 0.45 + (size - 2) * 0.2 + rand(i * 5.9) * 0.2,
    twinkles: rand(i * 7.3) > 0.65,
    duration: 2.4 + rand(i * 9.1) * 3.6,
    delay: rand(i * 11.7) * 4,
  }
})

/**
 * Cielo con ciclo día-noche.
 *
 * Las estrellas van aquí y no en el render: así la noche cae de forma continua
 * al acercarse al acantilado, en vez de aparecer de golpe con el bioma. Y el
 * mismo terreno sirve para cualquier hora sin volver a renderizarlo.
 */
export default function NightSky({ night }: NightSkyProps) {
  // El atardecer es un punto intermedio, no una mezcla lineal de día y noche.
  const top = night < 0.5 ? mix(DAY.top, DUSK.top, night * 2) : mix(DUSK.top, NIGHT.top, (night - 0.5) * 2)
  const mid = night < 0.5 ? mix(DAY.mid, DUSK.mid, night * 2) : mix(DUSK.mid, NIGHT.mid, (night - 0.5) * 2)
  const bottom =
    night < 0.5
      ? mix(DAY.bottom, DUSK.bottom, night * 2)
      : mix(DUSK.bottom, NIGHT.bottom, (night - 0.5) * 2)

  // Las estrellas solo asoman cuando el cielo ya está oscuro.
  const visible = Math.max(0, (night - 0.55) / 0.45)

  return (
    <>
      <div
        className={styles.sky}
        style={{ '--sky-top': top, '--sky-mid': mid, '--sky-bottom': bottom } as CSSProperties}
      />
      {visible > 0 ? (
        <div className={styles.stars} style={{ opacity: visible }} aria-hidden="true">
          {STARS.map((star, index) => (
            <span
              key={index}
              className={`${styles.star} ${star.twinkles ? styles.twinkle : ''}`}
              style={
                {
                  left: `${star.left}%`,
                  top: `${star.top}%`,
                  width: star.size,
                  height: star.size,
                  opacity: star.alpha,
                  '--star-alpha': star.alpha,
                  '--twinkle-dur': `${star.duration}s`,
                  '--twinkle-delay': `${star.delay}s`,
                } as CSSProperties
              }
            />
          ))}
          <span className={styles.moon} />
        </div>
      ) : null}
    </>
  )
}
