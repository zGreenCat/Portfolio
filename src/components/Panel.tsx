import type { CSSProperties, ReactNode } from 'react'

import styles from './Panel.module.css'

interface PanelProps {
  /** Rótulo pequeño sobre el título. */
  eyebrow?: string
  title: string
  /** `dialog` cuando hay algo que elegir dentro; `region` para lectura. */
  role?: 'region' | 'dialog'
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia al lugar. */
  openness: number
  /**
   * Dónde va la hoja en pantallas estrechas. Abajo por defecto. `top` es para
   * cuando lo que hay que ver está en el suelo: en vertical el mundo ocupa la
   * mitad baja, y una hoja inferior tapaba al personaje celebrando en el podio.
   */
  narrow?: 'bottom' | 'top'
  /**
   * Cajón más estrecho, para cuando lo que hay detrás también hay que verlo
   * entero y el contenido es poco. Solo cambia en ancho; en estrecho no.
   */
  slim?: boolean
  children: ReactNode
}

/**
 * Carcasa común de los paneles del recorrido.
 *
 * Reúne lo que los tres repetían —posición, velo, entrada, apertura y el
 * bloqueo de foco— para que cada uno se quede solo con su contenido.
 *
 * El marco es sobrio a propósito: lo que conserva la identidad del juego es lo
 * que va DENTRO —la rejilla de crafteo, las ranuras de inventario—, no la caja
 * de piedra biselada que lo envolvía.
 */
export default function Panel({
  eyebrow,
  title,
  role = 'region',
  openness,
  narrow = 'bottom',
  slim = false,
  children,
}: PanelProps) {
  if (openness <= 0.01) return null

  const style: CSSProperties = {
    opacity: openness,
    // Entra deslizando desde la derecha, no escalando desde el centro.
    translate: `${(1 - openness) * 48}px 0`,
    pointerEvents: openness > 0.9 ? 'auto' : 'none',
  }

  return (
    <div
      className={`${styles.wrap} ${narrow === 'top' ? styles.narrowTop : ''} ${slim ? styles.slim : ''}`}
      style={{ opacity: openness }}
    >
      <div className={styles.scrim} aria-hidden="true" />
      {/*
       * `inert` hasta que está abierto del todo: con `pointerEvents: none` el
       * ratón ya no llegaba, pero sus botones seguían en el orden de tabulación
       * desde el 2% de apertura y con teclado se entraba en un panel fantasma.
       */}
      <aside
        className={styles.drawer}
        style={style}
        role={role}
        aria-label={title}
        inert={openness <= 0.9}
      >
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.rule} />
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  )
}
