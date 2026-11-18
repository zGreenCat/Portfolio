import type { CSSProperties } from 'react'

import { CONTACT } from '@/content/portfolio'

import styles from './Signs.module.css'

interface SignsProps {
  /** 0 = invisible. Lo gobierna la distancia, como los demás paneles. */
  openness: number
  /** Irse volando a un enlace que lleva fuera. Devuelve false si no puede
   *  —hay otro gesto en curso, o se pidió menos movimiento— y entonces el
   *  enlace se abre como siempre. */
  onFly: (href: string) => boolean
}

/** Los carteles que llevan a otro sitio: a esos se va volando. El correo abre
 *  el programa de correo y el CV se descarga; no hay adónde volar. */
const FLIES = new Set(['github', 'linkedin'])

/**
 * Carteles de contacto clavados en el suelo del acantilado.
 *
 * El cartel es el widget de enlace nativo del mundo de Minecraft, así que no
 * hace falta explicarlo. Van dentro de la capa del suelo para que se desplacen
 * con él: son parte del sitio, no una interfaz superpuesta.
 *
 * La tabla y el poste son el cartel de roble del juego, renderizado con su
 * textura (`scripts/render/props.py`); aquí solo se le escribe encima. Fueron
 * dos cajas de color en CSS y no se leían como carteles.
 *
 * Van junto al cantil, a la izquierda de donde se sienta el personaje, y la
 * fila crece hacia la izquierda desde su ancla (`signsAnchor`). Con ellos, un
 * farol: allí ya es de noche y eran lo más oscuro del cuadro.
 */
export default function Signs({ openness, onFly }: SignsProps) {
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
          onClick={(event) => {
            // Con una tecla modificadora, o con otro botón, manda el
            // navegador: quien quiere una pestaña nueva la tiene.
            if (!FLIES.has(item.id) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            if (onFly(item.href)) event.preventDefault()
          }}
        >
          <span className={styles.board}>{item.label}</span>
        </a>
      ))}
      {/* La farola: base de piedra, poste, travesaño y dos faroles del juego.
          Va detrás de los carteles, en el centro de la fila; su luz la pone
          la fila por delante. */}
      <span className={styles.lamp} aria-hidden="true" />
    </div>
  )
}
