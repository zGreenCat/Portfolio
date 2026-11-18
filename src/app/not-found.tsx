import type { CSSProperties } from 'react'
import type { Metadata } from 'next'

import LostWays from '@/components/LostWays'
import { ISLAND, LOST, frameAt, heroBox, span } from '@/components/lostSheet'
import styles from './not-found.module.css'

export const metadata: Metadata = {
  title: 'Te perdiste · Vicente Araya',
  robots: { index: false },
}

/**
 * La dirección no existe: el personaje cae al End, el sitio que queda fuera
 * del mapa. La caída, el golpe y el quedarse mirando son tres animaciones CSS
 * encadenadas sobre la misma hoja; lo único con JavaScript es la salida
 * (`LostWays`), que lo tira de la isla antes de navegar.
 */
export default function NotFound() {
  const box = heroBox()
  const [fallFrom, fallTo] = span('fall')
  const [landFrom, landTo] = span('land')
  const [lookFrom, lookTo] = span('look')
  const vars = {
    '--land-x': `${(ISLAND.land.x / ISLAND.width) * 100}%`,
    '--land-y': `${(ISLAND.land.y / ISLAND.height) * 100}%`,
    '--island-ratio': `${ISLAND.width} / ${ISLAND.height}`,
    '--hero-left': `${box.left}%`,
    '--hero-top': `${box.top}%`,
    '--hero-width': `${box.width}%`,
    '--hero-ratio': `${LOST.cellWidth} / ${LOST.cellHeight}`,
    '--frames': LOST.frames,
    '--sheet': `url(${LOST.src})`,
    '--sheet-half': `url(${LOST.halfSrc})`,
    '--fall-from': `${frameAt(fallFrom)}%`,
    '--fall-to': `${frameAt(fallTo)}%`,
    '--land-from': `${frameAt(landFrom)}%`,
    '--land-to': `${frameAt(landTo)}%`,
    '--look-from': `${frameAt(lookFrom)}%`,
    '--look-to': `${frameAt(lookTo)}%`,
  } as CSSProperties

  return (
    <main className={styles.end} style={vars} data-end>
      <div className={styles.glow} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/end/far.webp" alt="" className={styles.far} />

      <div className={styles.scene}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ISLAND.src} alt="" className={styles.island} />
        <div className={styles.hero} aria-hidden="true" />
      </div>

      <div className={styles.text}>
        <h1 className={styles.code}>404</h1>
        <p className={styles.lead}>Te perdiste. Esta página no existe.</p>
        <LostWays className={styles.ways} primaryClass={styles.primary} secondClass={styles.second} />
      </div>
    </main>
  )
}
