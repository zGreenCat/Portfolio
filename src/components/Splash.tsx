'use client'

import Link from 'next/link'

import styles from './Splash.module.css'

interface SplashProps {
  /** 0 = del todo a la vista, 1 = apartada. La gobierna el scroll. */
  away: number
}

/**
 * Pantalla partida de entrada: la persona a un lado, su personaje al otro.
 *
 * **No es una puerta.** Scrollear la aparta y el mundo sigue detrás, sin
 * clic ni carga de por medio. Poner a elegir antes de enseñar nada habría
 * hecho opcional justo la parte que demuestra algo: puesto a decidir entre
 * «normal» e «inmersivo», casi todo el mundo pulsa normal.
 *
 * El enlace a la versión en texto vive aquí a tamaño completo porque en la
 * barra era el sexto botón, detrás de cinco secciones.
 */
export default function Splash({ away }: SplashProps) {
  if (away >= 1) return null

  return (
    <div
      className={styles.splash}
      style={{ opacity: 1 - away, translate: `0 ${away * -12}vh` }}
      // Apartada a medias ya no se puede usar: si no, el enlace seguía
      // clicable mientras se desvanecía.
      inert={away > 0.4}
    >
      <Link href="/simple" className={`${styles.half} ${styles.person}`}>
        <span className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/me.webp" alt="Vicente Araya" className={styles.shot} />
        </span>
        <span className={styles.label}>Ver en texto</span>
        <span className={styles.hint}>Proyectos, stack y contacto. Sin animaciones.</span>
      </Link>

      <div className={`${styles.half} ${styles.avatar}`}>
        <span className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/me-skin.webp" alt="" className={styles.shot} aria-hidden="true" />
        </span>
        <span className={styles.label}>Entrar al mundo</span>
        <span className={styles.hint}>Un recorrido construido a mano. Baja para empezar.</span>
      </div>

      <h1 className={styles.name}>Vicente Araya</h1>
      <span className={styles.scroll} aria-hidden="true">
        ↓
      </span>
    </div>
  )
}
