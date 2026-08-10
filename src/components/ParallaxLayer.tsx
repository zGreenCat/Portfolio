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
  /** Usa la variante a mitad de resolución. Una capa de 3840×1440 ocupa 21 MB
   *  descomprimida pese a pesar 300 KB, y con tres biomas montados eso son
   *  253 MB: suficiente para que Safari en iOS mate la pestaña. */
  half?: boolean
  /** Teselas extra hacia la IZQUIERDA del ancla. Una tesela anclada no cubre
   *  el mundo anterior a ella, y ahí quedaba un hueco sin suelo. Al ir
   *  espejadas, el terreno continúa sin costura. */
  extend?: number
  /** Territorio del bioma, en coordenadas del contenedor. Fuera de ahí no se
   *  dibuja. Recortar en vez de fundir evita ver dos terrenos a la vez: un
   *  cactus sobre un cerezo es inevitable si se mezcla por opacidad. */
  clipFrom?: number
  clipTo?: number
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
export default function Strip({
  src,
  travel,
  tileWidth,
  opacity,
  anchor,
  half,
  extend = 0,
  clipFrom,
  clipTo,
}: StripProps) {
  const file = half ? src.replace('.webp', '@half.webp') : src
  const anchored = anchor !== undefined
  const tiles = anchored ? 1 + extend : Math.max(2, Math.ceil((travel + tileWidth) / tileWidth) + 1)
  // Con teselas antes del ancla, la fila arranca a su izquierda y la copia
  // anclada tiene que caer en la paridad sin espejar.
  const left = anchored ? (anchor ?? 0) - extend * tileWidth : 0
  const parity = anchored ? extend % 2 : 0

  // El recorte va en coordenadas propias de la tira, que empieza en `left`.
  const width = tiles * tileWidth
  const clip =
    clipFrom === undefined || clipTo === undefined
      ? undefined
      : `inset(0 ${Math.max(0, width - (clipTo - left))}px 0 ${Math.max(0, clipFrom - left)}px)`

  return (
    <div className={styles.strip} style={{ opacity, left, clipPath: clip }} aria-hidden="true">
      {Array.from({ length: tiles }, (_, index) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={index}
          src={file}
          alt=""
          className={styles.tile}
          style={index % 2 !== parity ? { transform: 'scaleX(-1)' } : undefined}
        />
      ))}
    </div>
  )
}
