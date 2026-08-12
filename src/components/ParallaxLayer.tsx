import styles from './ParallaxLayer.module.css'

interface StripProps {
  src: string
  /** Píxeles de mundo que recorre esta capa de punta a punta. */
  travel: number
  /** Ancho de la imagen una vez escalada. Igual para todas las capas: aunque
   *  cada una mide distinto de alto, todas salen del mismo render de 3840. */
  tileWidth: number
  /** Alto en pantalla de ESTA capa. Cada una conserva el suyo, así que una capa
   *  con árboles altos sobresale por encima de la caja del mundo en vez de
   *  quedar aplastada dentro de ella. */
  tileHeight: number
  /** Fracción del avance del mundo que recorre esta capa. */
  speed: number
  /** Ancho de la ventana, en px. Marca cuánto margen hay que cubrir a cada
   *  lado del territorio para que no se vea el borde de la tira. */
  viewport: number
  /** Territorio del bioma en coordenadas de mundo. Fuera de ahí no se dibuja:
   *  recortar en vez de fundir evita ver dos terrenos a la vez, que es lo que
   *  ponía un cactus sobre un cerezo. */
  spanFrom: number
  spanTo: number
  /** Desplazamiento del recorte en el momento del montaje. El bucle lo
   *  reescribe en cada frame; esto solo evita un frame sin recortar. */
  shift: number
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
 * Solo se montan las teselas que el bioma puede llegar a enseñar. Cubrir el
 * mundo entero salían siete por capa y el recorte dejaba ver dos: las otras
 * cinco eran nodos y composición para nada.
 *
 * No lleva el `transform`: eso vive en el contenedor, que agrupa todos los
 * biomas de una misma velocidad para que se muevan como uno.
 */
export default function Strip({
  src,
  travel,
  tileWidth,
  tileHeight,
  speed,
  viewport,
  spanFrom,
  spanTo,
  shift,
  anchor,
  half,
  extend = 0,
}: StripProps) {
  const file = half ? src.replace('.webp', '@half.webp') : src
  const anchored = anchor !== undefined
  const reach = travel + tileWidth

  let left: number
  let tiles: number

  if (anchored) {
    tiles = 1 + extend
    left = (anchor ?? 0) - extend * tileWidth
  } else {
    // Una coordenada de mundo X se ve mientras la cámara esté entre X-viewport
    // y X, y ahí cae en la tira sobre cámara*speed … cámara*speed+viewport.
    const min = Math.max(0, (spanFrom - viewport) * speed)
    const max = Math.min(reach, (spanTo + viewport) * speed + viewport)
    const first = Math.max(0, Math.floor(min / tileWidth))
    const last = Math.min(Math.ceil(reach / tileWidth), Math.ceil(max / tileWidth))
    left = first * tileWidth
    tiles = Math.max(2, last - first)
  }

  // El volteo va por índice absoluto de tesela: si la tira empieza más allá del
  // origen, la paridad tiene que seguir siendo la misma o aparece la costura.
  const parity = anchored ? extend % 2 : (left / tileWidth) % 2

  const width = tiles * tileWidth
  const clip = `inset(0 ${Math.max(0, width - (spanTo - shift - left))}px 0 ${Math.max(0, spanFrom - shift - left)}px)`

  return (
    <div
      className={styles.strip}
      style={{ left, clipPath: clip, height: tileHeight }}
      data-strip=""
      data-from={spanFrom}
      data-to={spanTo}
      data-speed={speed}
      data-left={left}
      data-width={width}
      aria-hidden="true"
    >
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
