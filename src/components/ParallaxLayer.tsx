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
  /**
   * Fracción de la tesela, desde la izquierda, que tiene terreno; el resto es
   * vacío transparente. Es el suelo del acantilado, que acaba en el cantil.
   *
   * Sin esto las teselas extra se ponían una al lado de otra, y el espejo de
   * una tesela con vacío a la derecha tiene el vacío a la izquierda: a dos
   * teselas del ancla quedaban dos vacíos pegados, un agujero sin suelo. En
   * escritorio caía antes de la frontera del bioma y el recorte lo tapaba; en
   * un móvil, con teselas la mitad de anchas, caía dentro y se caminaba sobre
   * la nada. Con esto las extra se solapan para encadenar solo su terreno.
   */
  solid?: number
  /**
   * Corre la tira esta distancia, en px, sin cambiar qué tramo cubre. Sirve
   * para que la frontera del bioma caiga en un claro de la tesela y no a
   * mitad de un árbol. Solo tiene sentido en el suelo: las demás capas van a
   * otro ritmo y su recorte se desliza sobre ellas al andar.
   */
  phase?: number
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
  solid,
  phase = 0,
}: StripProps) {
  const file = half ? src.replace('.webp', '@half.webp') : src
  const anchored = anchor !== undefined
  const reach = travel + tileWidth

  let left: number
  let tiles: number
  let firstIndex = 0

  /** Dónde empieza cada tesela respecto a la primera, cuando no van seguidas. */
  let offsets: number[] | null = null

  if (anchored && solid !== undefined && extend > 0) {
    // De izquierda a derecha, acabando en la anclada. La copia k cubre con su
    // terreno el tramo [-k·s, -(k-1)·s] respecto al ancla: las impares van
    // volteadas, con el terreno a su derecha; las pares, sin voltear, con el
    // terreno a su izquierda.
    const ground = solid * tileWidth
    const starts = Array.from({ length: extend }, (_, i) => {
      const k = extend - i
      return k % 2 === 0 ? -k * ground : -(k - 1) * ground - tileWidth
    })
    starts.push(0)
    tiles = starts.length
    left = (anchor ?? 0) + starts[0]
    offsets = starts.map((start) => start - starts[0])
  } else if (anchored) {
    tiles = 1 + extend
    left = (anchor ?? 0) - extend * tileWidth
  } else {
    // Una coordenada de mundo X se ve mientras la cámara esté entre X-viewport
    // y X, y ahí cae en la tira sobre cámara*speed … cámara*speed+viewport.
    const min = Math.max(0, (spanFrom - viewport) * speed) - phase
    const max = Math.min(reach, (spanTo + viewport) * speed + viewport) - phase
    // Con la tira corrida, la primera tesela puede quedar antes del origen.
    const first = Math.max(phase > 0 ? -2 : 0, Math.floor(min / tileWidth))
    const last = Math.min(Math.ceil(reach / tileWidth), Math.ceil(max / tileWidth))
    left = first * tileWidth + phase
    tiles = Math.max(2, last - first)
    firstIndex = first
  }

  // El volteo va por índice absoluto de tesela: si la tira empieza más allá del
  // origen, la paridad tiene que seguir siendo la misma o aparece la costura.
  const parity = anchored ? extend % 2 : ((firstIndex % 2) + 2) % 2

  const width = offsets ? offsets[offsets.length - 1] + tileWidth : tiles * tileWidth
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
          decoding="async"
          className={styles.tile}
          style={{
            transform: index % 2 !== parity ? 'scaleX(-1)' : undefined,
            // Lo que le falta para caer en su sitio. El +1 deshace el píxel
            // de solape que cada tesela ya lleva a su derecha.
            marginLeft:
              offsets && index > 0 ? offsets[index] - offsets[index - 1] - tileWidth + 1 : undefined,
          }}
        />
      ))}
    </div>
  )
}
