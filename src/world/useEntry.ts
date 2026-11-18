'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

import { COVER_LEAVE_MS } from '@/components/Cover'

import {
  MOUNT_RADIUS,
  SECTIONS,
  scrollFromWorld,
  worldFromScroll,
  type CoverState,
  type Phase,
} from './constants'
import { landingAt, sectionsNear } from './geometry'
import { useWorldLoading } from './useLoading'
import type { WorldRefs } from './useWorldRefs'

interface EntryDeps {
  refs: WorldRefs
  phase: Phase
  setPhase: Dispatch<SetStateAction<Phase>>
  setMounted: Dispatch<SetStateAction<number[]>>
  setActive: Dispatch<SetStateAction<string>>
  setHidden: Dispatch<SetStateAction<boolean>>
}

/**
 * Cómo se llega al mundo: por la portada, con el ancla de una sección o
 * volviendo adonde se estaba. Lleva la carga, la portada —puesta, apartándose
 * o fuera— y el reaterrizaje, y decide en qué fase arranca el mundo.
 */
export function useEntry({ refs, phase, setPhase, setMounted, setActive, setHidden }: EntryDeps) {
  const { chestAtRef, mountKeyRef, resumeRef, snapRef } = refs
  /** La portada. Arranca puesta también en el servidor: su contenido tiene
   *  que ir en el HTML servido. */
  const [cover, setCover] = useState<CoverState>('on')
  const coverRef = useRef<CoverState>('on')
  /** Vuelve con un `/tp`: entra barriendo, al revés de como se aparta. */
  const [coverArrives, setCoverArrives] = useState(false)

  /**
   * Se calcula al terminar la carga, no antes: hay que leer el scroll ya
   * restaurado por el navegador. La posición manda sobre el hash porque refleja
   * dónde estabas de verdad; el hash solo entra si no hay scroll, que es el
   * caso de un enlace compartido abierto en frío.
   */
  const resumeTarget = useCallback(() => {
    const progress = worldFromScroll(window.scrollY)
    if (progress > 0.01) {
      let best = 0
      SECTIONS.forEach((section, i) => {
        if (Math.abs(section.at - progress) < Math.abs(SECTIONS[best].at - progress)) best = i
      })
      return best
    }
    const hash = window.location.hash.slice(1)
    const byHash = SECTIONS.findIndex((section) => section.id === hash)
    return byHash > 0 ? byHash : null
  }, [])

  /**
   * Dónde aterriza la perla. No es exactamente la sección: caer justo encima
   * deja la siguiente frontera de bioma dentro del cuadro.
   *
   * La frontera aparece en pantalla en `edge - worldX`, medido desde el borde
   * IZQUIERDO. Para dejarla fuera hay que retroceder un viewport entero, no el
   * hueco que queda a la derecha del personaje.
   *
   * El retroceso está acotado por `PANEL_OPEN_AT`: más atrás de eso, llegarías
   * con el cofre entreabierto.
   */
  const landingFor = useCallback(
    (index: number) => landingAt(index, chestAtRef.current, window.innerWidth),
    [chestAtRef],
  )

  /**
   * Prepara la vuelta: monta el bioma de destino, mueve el documento y deja la
   * posición lista para que la coloque la entrada. Devuelve false si es una
   * visita limpia y toca saludar.
   */
  const armResume = useCallback(() => {
    const index = resumeTarget()
    if (index === null) return false
    const at = landingFor(index)
    resumeRef.current = at

    // El bioma tiene que estar montado antes de colocar el mundo: si no, no hay
    // tiras que recortar y la caminata ocurre sobre el terreno equivocado.
    const near = sectionsNear(at, MOUNT_RADIUS)
    mountKeyRef.current = near.join(',')
    setMounted(near)
    setActive(SECTIONS[index].id)
    window.history.replaceState(null, '', `#${SECTIONS[index].id}`)
    window.scrollTo({ top: scrollFromWorld(at), behavior: 'auto' })
    return true
  }, [landingFor, resumeTarget])

  /**
   * Fin de la carga. Con la portada puesta el mundo espera detrás, quieto: la
   * entrada caminando arranca al apartarla.
   */
  const begin = useCallback(() => {
    if (coverRef.current !== 'off') {
      setPhase('waiting')
      return
    }
    setPhase(armResume() ? 'entering' : 'greeting')
  }, [armResume])

  // Con el ancla de una sección o con el scroll restaurado se llega al mundo,
  // sin portada. El CSS ya la esconde cuando hay ancla; esto la desmonta.
  useLayoutEffect(() => {
    if (window.location.hash.length > 1 || window.scrollY > 0) {
      coverRef.current = 'off'
      setCover('off')
    }
  }, [])

  const enterWorld = useCallback(() => {
    if (coverRef.current !== 'on') return
    coverRef.current = 'leaving'
    setCover('leaving')
    setHidden(false)
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(
      () => {
        coverRef.current = 'off'
        setCover('off')
        // La primera vez saluda, como siempre: asoma, saluda y entra andando.
        setPhase((now) => (now === 'waiting' ? 'greeting' : now))
      },
      still ? 0 : COVER_LEAVE_MS,
    )
  }, [])

  /** Vuelve a poner la portada. El mundo regresa al inicio: a medio camino
   *  podía quedar un cajón abierto asomando por la diagonal. `arrives` la
   *  hace entrar barriendo; sin él aparece de golpe. */
  const openCover = useCallback((arrives = false) => {
    snapRef.current = true
    window.scrollTo({ top: 0, behavior: 'auto' })
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setActive('inicio')
    coverRef.current = 'on'
    setCoverArrives(arrives)
    setCover('on')
  }, [])

  const progress = useWorldLoading(begin)

  useEffect(() => {
    // En pantallas táctiles el scroll no se suelta nunca: se anda con los
    // botones, que lo mueven por código. Con el dedo, el navegador desplazaba
    // primero su propia página y luego avanzaba el personaje.
    const touch = window.matchMedia('(pointer: coarse)').matches
    // Con la portada puesta tampoco: ella baja dentro de su propia caja, y el
    // scroll del documento es la posición del mundo.
    document.body.style.overflow = phase === 'ready' && !touch && cover === 'off' ? '' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [phase, cover])

  return { cover, coverRef, coverArrives, landingFor, enterWorld, openCover, progress }
}
