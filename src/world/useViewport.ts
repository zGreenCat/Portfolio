'use client'

import { useEffect, useState } from 'react'

import {
  CHAR_HEIGHT_VH,
  LAYER_ASPECT,
  PEEK,
  PEEK_CELL_VH,
  PEEK_CELL_VW,
  PORTRAIT_WORLD,
  SCROLL_LENGTH,
  wantsHalfLayers,
  wantsHalfSprites,
} from './constants'
import { fitBounds } from './geometry'

/**
 * Lo que sale del tamaño de la ventana: cuánto mide la caja del mundo, a qué
 * resolución se sirven capas y hojas, y lo que mide el personaje. Se rehace al
 * cambiar la ventana, y de paso recalcula el territorio de los biomas.
 *
 * En el servidor y hasta montar valen los de partida: `worldPx` a cero es la
 * señal de que aún no se ha medido.
 */
export function useViewport() {
  const [charHeight, setCharHeight] = useState(200)
  const [peekScale, setPeekScale] = useState(1)
  const [pageHeight, setPageHeight] = useState(SCROLL_LENGTH)
  const [worldPx, setWorldPx] = useState(0)
  const [viewW, setViewW] = useState(1920)
  /** De partida, las medias: es lo que acaba viendo casi todo el mundo —un
   *  móvil, y también un 1080p a 1×—, y lo que vale aquí es lo que pinta el
   *  servidor. Partía de las enteras, y el HTML servido pedía las cuatro capas
   *  de 3840 px del primer bioma para cambiarlas por las medias al arrancar:
   *  1,7 MB de más y 88 MB decodificados en un teléfono. Ahora solo las
   *  pantallas grandes bajan las dos. */
  const [half, setHalf] = useState(true)
  /** Lo mismo para las hojas del personaje, que se deciden aparte: dependen
   *  de lo que mide él en pantalla, no la tesela. */
  const [spriteHalf, setSpriteHalf] = useState(false)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const fit = () => {
      const portrait = window.innerHeight > window.innerWidth
      const world = window.innerHeight * (portrait ? PORTRAIT_WORLD : 1)
      setWorldPx(world)
      setViewW(window.innerWidth)
      setHalf(wantsHalfLayers())
      setSpriteHalf(wantsHalfSprites())
      fitBounds(window.innerWidth, world * LAYER_ASPECT)
      setCompact(window.innerWidth <= 760)
      setCharHeight(world * CHAR_HEIGHT_VH)
      setPeekScale(
        Math.min(
          (window.innerHeight * PEEK_CELL_VH) / PEEK.cellHeight,
          (window.innerWidth * PEEK_CELL_VW) / PEEK.cellWidth,
        ),
      )
      setPageHeight(SCROLL_LENGTH + window.innerHeight)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return { worldPx, viewW, half, spriteHalf, compact, charHeight, peekScale, pageHeight }
}
