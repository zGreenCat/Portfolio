import type { CSSProperties } from 'react'

import { CONTACT } from '@/content/portfolio'

import styles from './Signs.module.css'

interface SignsProps {
  /** 0 = invisible. Lo gobierna la distancia, como los demás paneles. */
  openness: number
}

/**
 * Carteles de contacto clavados en el suelo del acantilado.
 *
 * El cartel es el widget de enlace nativo del mundo de Minecraft, así que no
 * hace falta explicarlo. Van dentro de la capa del suelo para que se desplacen
 * con él: son parte del sitio, no una interfaz superpuesta.
 */
export default function Signs({ openness }: SignsProps) {
  if (openness <= 0.01) return null

  const style: CSSProperties = {
    opacity: openness,
    pointerEvents: openness > 0.9 ? 'auto' : 'none',
  }

    // Hasta que no está abierto del todo no se puede usar con el ratón
    // (`pointerEvents: none`), pero sus botones seguían en el orden de
    // tabulación desde el 2% de apertura: con teclado se entraba en un panel
    // fantasma. `inert` lo saca del tab y del árbol de accesibilidad.
  return (
    <div className={styles.row} style={style} inert={openness <= 0.9}>
      {CONTACT.map((item) => (
        <a
          key={item.id}
          className={styles.sign}
          href={item.href}
          {...('download' in item && item.download
            ? { download: '' }
            : { target: '_blank', rel: 'noreferrer' })}
        >
          <span className={styles.board}>{item.label}</span>
          <span className={styles.post} />
        </a>
      ))}
    </div>
  )
}
