import styles from './ParallaxLayer.module.css'

interface StripProps {
  src: string
  /** Píxeles de mundo que recorre esta capa de punta a punta. */
  travel: number
  /** Ancho de la imagen una vez escalada a 100vh. */
  tileWidth: number
  /** 0 = invisible. Es lo que funde un bioma con el siguiente. */
  opacity: number
  /** Una sola copia anclada a esta X de mundo, sin repetir. Lo usa el
   *  acantilado: repetirlo daría un cantil detrás de otro. */
  anchor?: number
}

/**
 * Tira de una capa, repetida alternando volteada: original, espejo, original…
 *
 * Los renders no son teselables, así que repetirlos tal cual dejaría costura.
 * Volteando una de cada dos, el borde derecho de una toca siempre el borde
 * derecho de la siguiente, así que encajan por construcción. A cambio el
 * paisaje queda simétrico cada dos repeticiones, cosa que apenas se nota en
 * terreno irregular y menos aún en las capas de fondo, que van con niebla.
 *
 * No lleva el `transform`: eso vive en el contenedor, que agrupa todos los
 * biomas de una misma velocidad para que se muevan como uno.
 */
export default function Strip({ src, travel, tileWidth, opacity, anchor }: StripProps) {
  const tiles = anchor === undefined ? Math.max(2, Math.ceil((travel + tileWidth) / tileWidth) + 1) : 1

  return (
    <div
      className={styles.strip}
      style={{ opacity, left: anchor ?? 0 }}
      aria-hidden="true"
    >
      {Array.from({ length: tiles }, (_, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={src}
          alt=""
          className={styles.tile}
          style={index % 2 === 1 ? { transform: 'scaleX(-1)' } : undefined}
        />
      ))}
    </div>
  )
}
