'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import Character, {
  CELL_WIDTH,
  FRAME_COUNT,
  SHEET_GEOMETRY,
  THROW_RELEASE,
  type CharacterState,
} from '@/components/Character'
import { loopsByItself } from '@/components/characterSheets'
import Chat from '@/components/Chat'
import EnderPearl from '@/components/EnderPearl'
import Book from '@/components/Book'
import CraftingTable from '@/components/CraftingTable'
import Inventory from '@/components/Inventory'
import PerfMeter from '@/components/PerfMeter'
import Podium, { PodiumMedal } from '@/components/Podium'
import WalkPad from '@/components/WalkPad'
import Cover, { COVER_LEAVE_MS } from '@/components/Cover'
import NightSky, { skyAt } from '@/components/NightSky'
import Signs from '@/components/Signs'
import { BLOCK_PX_SOURCE, WORLD_UNIT } from '@/content/layers'
import Weather from '@/components/Weather'
import { play } from '@/lib/sounds'
import { ABOUT_PAGES, PROJECTS } from '@/content/portfolio'
import { BackLayers, GroundLayer, StageProp, type LayerSpace } from '@/components/WorldLayers'
import { SheetWarmer, WorldLoader, WorldNav } from '@/components/WorldChrome'
import SpriteGrid from '@/components/SpriteGrid'

import {
  CHAR_FEET_VH,
  CHAR_HEIGHT_VH,
  CLIFF_EDGE,
  CLIFF_X,
  DUSK_FROM,
  ENTRY_FROM,
  ENTRY_SECONDS,
  ENTRY_TO,
  HALF_RES_WIDTH,
  LAYER_ASPECT,
  LAYER_SPEED,
  MOUNT_RADIUS,
  NIGHT_AT,
  NIGHT_STEPS,
  PANEL_OPEN_AT,
  PEEK,
  PEEK_CELL_VH,
  PEEK_CELL_VW,
  PORTRAIT_WORLD,
  RUN_SCREENS,
  SCROLL_LENGTH,
  SECTIONS,
  SPLASHES,
  STRIDE,
  THROW_MS,
  WALK_SCREENS,
  WORLD_LENGTH,
  peekSrc,
  scrollFromWorld,
  wantsHalfLayers,
  wantsHalfSprites,
  worldFromScroll,
} from '@/world/constants'
import { BOUNDS, biomeAt, sectionsNear, fitBounds, quantize } from '@/world/geometry'
import { CHEST_GAP, CHEST_PX, MEDAL, PODIUM_AT, PODIUM_X, STAGE } from '@/world/podium'

import { useBackgroundFetch, useWorldLoading } from '@/world/useLoading'
import { useTeleport } from '@/world/useTeleport'
import { useWorldRefs } from '@/world/useWorldRefs'
import { useWorldLoop } from '@/world/useWorldLoop'
import type { CoverState, Phase } from '@/world/constants'

import styles from './recorrido.module.css'



export default function RecorridoPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  /** La portada. Arranca puesta también en el servidor: su contenido tiene
   *  que ir en el HTML servido. */
  const [cover, setCover] = useState<CoverState>('on')
  const coverRef = useRef<CoverState>('on')
  const refs = useWorldRefs()
  const {
    worldDeltaRef,
    worldAtRef,
    actorXRef,
    feetVhRef,
    weatherRef,
    mountKeyRef,
    sandRef,
    fogRef,
    fogWrittenRef,
    facingRef,
    sitRef,
    sitWantRef,
    sitDirRef,
    sitLockRef,
    catchUpRef,
    podiumRef,
    podiumWantRef,
    podiumDirRef,
    chestAtRef,
    podiumAskRef,
    podiumAheadRef,
    podiumLandRef,
    podiumFromRef,
    podiumFocusRef,
    slowRef,
    liteLockRef,
    resumeRef,
    stripsRef,
    warmRef,
    rootRef,
    spriteRef,
    farRef,
    midRef,
    nearRef,
    groundRef,
    markersRef,
    propsRef,
    actorRef,
    stateRef,
    snapRef,
    teleportingRef,
    warmAtRef,
  } = refs
  /** Vuelve con un `/tp`: entra barriendo, al revés de como se aparta. */
  const [coverArrives, setCoverArrives] = useState(false)
  const [characterState, setCharacterState] = useState<CharacterState>('idle')
  const [charHeight, setCharHeight] = useState(200)
  const [peekScale, setPeekScale] = useState(1)
  const [started, setStarted] = useState(false)
  const [splash, setSplash] = useState(SPLASHES[0])
  const [active, setActive] = useState<string>('inicio')
  const [pageHeight, setPageHeight] = useState(SCROLL_LENGTH)
  const [chestOpen, setChestOpen] = useState(0)
  const [bookOpen, setBookOpen] = useState(0)
  const [signsOpen, setSignsOpen] = useState(0)
  const [benchOpen, setBenchOpen] = useState(0)
  /** Si el sistema pide menos movimiento, la versión en texto deja de ser un
   *  enlace más de la barra y se señala: ya dijeron que no quieren esto. */
  const [reduced, setReduced] = useState(false)
  const [worldPx, setWorldPx] = useState(0)
  const [viewW, setViewW] = useState(1920)
  const [half, setHalf] = useState(false)
  /** Lo mismo para las hojas del personaje, que se deciden aparte: dependen
   *  de lo que mide él en pantalla, no la tesela. */
  const [spriteHalf, setSpriteHalf] = useState(false)
  /** Biomas montados, por índice. Solo cambia al cruzar un radio, no por frame. */
  const [mounted, setMounted] = useState<number[]>([0])
  const [podiumOpen, setPodiumOpen] = useState(0)
  const [lite, setLite] = useState(false)
  /** `?fps`: enseña el medidor. */
  const [meter, setMeter] = useState(false)

  // Diagnóstico por URL. `?fps` enseña el medidor; `?lite=1` fuerza el modo
  // ligero y `?lite=0` lo prohíbe, para ver en el equipo real cuánto pesa.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.has('fps')) setMeter(true)
    if (query.get('lite') === '1') setLite(true)
    if (query.get('lite') === '0') liteLockRef.current = true
  }, [])
  const [menuOpen, setMenuOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  /** La noche va cuantizada: cambiarla mueve un `filter` CSS sobre superficies
   *  del ancho del mundo, y re-filtrar eso en cada frame era carísimo. */
  const [night, setNight] = useState(0)


  useEffect(() => setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]), [])
  useEffect(() => setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches), [])

  /**
   * Escribe el frame del sprite sobre el nodo. El ciclo va atado al avance real
   * del mundo, así que cambia en cada frame: como prop, re-renderizaba.
   *
   * La hoja se lee del propio nodo, NO de `stateRef`. El cambio de estado llega
   * al DOM cuando React re-renderiza, un frame más tarde, y en esa ventana las
   * dos fuentes discrepan: `run` mide 367 px de alto en 16 celdas y `walk` 399
   * en 25, así que el ancho de celda no coincide y el corte cae en mitad de un
   * frame. Se veían dos poses a la vez.
   */
  const writeFrame = useCallback(
    (index: number) => {
      const node = spriteRef.current
      const shown = node?.dataset.state as CharacterState | undefined
      if (!node || !shown) return
      const sheet = SHEET_GEOMETRY[shown]
      const width = CELL_WIDTH * ((worldPx * CHAR_HEIGHT_VH) / sheet.charHeight)
      const wrapped = ((index % sheet.frames) + sheet.frames) % sheet.frames
      node.style.backgroundPositionX = `${-wrapped * width}px`
    },
    [worldPx],
  )

  /**
   * En reposo el ciclo vuelve al CSS, y hay que borrar el frame que dejó el
   * bucle. El keyframe solo declara `to`, así que el `from` implícito sale del
   * valor que haya puesto: con el inline viejo, el ciclo arrancaba desalineado.
   */
  useEffect(() => {
    if (loopsByItself(characterState) && spriteRef.current) {
      spriteRef.current.style.backgroundPositionX = ''
    }
  }, [characterState])

  // --- gesto de lanzamiento ---
  // El primer frame se escribe al montar la hoja, antes de pintar. Lanzando en
  // marcha, el nodo traía el desplazamiento de la zancada, y sobre la hoja de
  // lanzar eso era una pose de mitad del gesto durante un frame.
  useLayoutEffect(() => {
    if (characterState === 'throw') writeFrame(0)
  }, [characterState, writeFrame])

  useEffect(() => {
    if (characterState !== 'throw') return
    const t0 = performance.now()
    let raf = 0
    let released = false
    const step = (now: number) => {
      // Nunca negativo: la marca del frame puede ser anterior al momento en
      // que arrancó el efecto, y un tiempo negativo daba el frame -1, que al
      // envolver es el último del gesto. Era el parpadeo al empezar a lanzar.
      const t = Math.max(0, (now - t0) / THROW_MS)
      if (!released && t >= THROW_RELEASE.frame / FRAME_COUNT.throw) {
        released = true
        play('throw')
      }
      if (t >= 1) {
        // Al acabar el gesto vuelve a reposo. Sin esto se quedaba clavado en
        // el último frame del lanzamiento mientras la perla seguía volando.
        stateRef.current = 'idle'
        setCharacterState('idle')
        return
      }
      writeFrame(Math.floor(t * FRAME_COUNT.throw))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [characterState, writeFrame])

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
  const landingFor = useCallback((index: number) => {
    const section = SECTIONS[index]
    // El cofre de Experiencias no está en el `at` de la sección: va delante del
    // escenario, y ahí es donde se abre su cajón.
    if (section.id === 'proyectos') return chestAtRef.current
    const edge = BOUNDS[index].to
    if (edge === Infinity) return section.at
    const clear = edge - window.innerWidth / WORLD_LENGTH
    return Math.max(section.at - PANEL_OPEN_AT, Math.min(section.at, clear))
  }, [])

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

  // --- carga ---
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

  // Releer la geometría de las tiras montadas. El recorte se reescribe en cada
  // frame y consultar el DOM ahí dentro sería absurdo.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-strip]'))
    stripsRef.current = nodes.map((el) => ({
      el,
      from: Number(el.dataset.from),
      to: Number(el.dataset.to),
      speed: Number(el.dataset.speed),
      left: Number(el.dataset.left),
      width: Number(el.dataset.width),
    }))
  }, [mounted, half, worldPx, viewW, phase])

  /**
   * Coloca el mundo en una posición: desplazamiento de capas, recorte de cada
   * bioma, altura de los pies y hora del día.
   *
   * Lo comparten el bucle y el reaterrizaje al volver. Antes esto solo existía
   * dentro del bucle, y como el bucle no arranca hasta `ready`, quien volvía
   * veía el bioma inicial durante toda la caminata de entrada y un cambio de
   * fondo de golpe al terminar.
   */
  const placeWorld = useCallback(
    (at: number) => {
      worldAtRef.current = at
      const worldX = at * WORLD_LENGTH
      const nodes: [HTMLDivElement | null, number][] = [
        [farRef.current, LAYER_SPEED.far],
        [midRef.current, LAYER_SPEED.mid],
        [nearRef.current, LAYER_SPEED.near],
        [groundRef.current, LAYER_SPEED.ground],
        [propsRef.current, LAYER_SPEED.ground],
        [markersRef.current, LAYER_SPEED.ground],
      ]
      nodes.forEach(([node, speed]) => {
        if (node) node.style.transform = `translate3d(${-worldX * speed}px,0,0)`
      })

      // El término (1-speed) hace que la frontera caiga en la MISMA x de
      // pantalla en todas las capas pese a que cada una corre a su ritmo. Sin
      // él, el fondo cortaba el bioma mucho antes que el suelo.
      stripsRef.current.forEach((strip) => {
        const shift = worldX * (1 - strip.speed)
        const right = Math.max(0, strip.width - (strip.to - shift - strip.left))
        const inset = Math.max(0, strip.from - shift - strip.left)
        strip.el.style.clipPath = `inset(0 ${right}px 0 ${inset}px)`
      })

      const spot = biomeAt(at)
      // Ya no depende del bioma: la importación recorta cada capa a la misma
      // distancia bajo su superficie, así que el suelo cae siempre a la misma
      // altura de pantalla y cruzar de bioma no da un escalón.
      const feet = CHAR_FEET_VH
      feetVhRef.current = feet
      rootRef.current?.style.setProperty('--char-feet', `${feet * worldPx}px`)

      const dark = Math.min(1, Math.max(0, (at - DUSK_FROM) / (NIGHT_AT - DUSK_FROM)))
      setNight(quantize(dark, NIGHT_STEPS))
      return spot
    },
    [worldPx],
  )

  // --- entrada al mundo ---
  useEffect(() => {
    if (phase !== 'entering') return
    const actor = actorRef.current
    if (!actor) return

    // Colocar el mundo ANTES de la caminata: quien vuelve tiene que entrar ya
    // en su bioma, no verse trasladado al acabar de andar.
    if (resumeRef.current !== null) placeWorld(resumeRef.current)

    stateRef.current = 'walk'
    setCharacterState('walk')

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      actor.style.left = `${ENTRY_TO}%`
      setPhase('ready')
      return
    }

    const distance = ((ENTRY_TO - ENTRY_FROM) / 100) * window.innerWidth
    const stride = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT) * STRIDE.walk
    const t0 = performance.now()
    let raf = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / (ENTRY_SECONDS * 1000))
      const eased = 1 - (1 - t) ** 3
      actor.style.left = `${ENTRY_FROM + (ENTRY_TO - ENTRY_FROM) * eased}%`
      writeFrame(Math.floor(((eased * distance) / stride) * FRAME_COUNT.walk))
      if (t < 1) {
        raf = requestAnimationFrame(step)
      } else {
        stateRef.current = 'idle'
        setCharacterState('idle')
        setPhase('ready')
      }
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, worldPx, writeFrame, placeWorld])

  // --- recorrido: el scroll es una posición del mundo, no una línea de tiempo ---
  useWorldLoop({
    refs,
    phase,
    worldPx,
    half,
    lite,
    writeFrame,
    placeWorld,
    setCharacterState,
    setLite,
    setStarted,
    setPodiumOpen,
    setChestOpen,
    setBookOpen,
    setSignsOpen,
    setBenchOpen,
    setActive,
    setMounted,
  })


  useBackgroundFetch(phase !== 'loading', half, spriteHalf)

  const {
    shot,
    chat,
    hidden,
    setHidden,
    navigate,
    tpToCover,
    sendChat,
    closeChat,
  } = useTeleport({
    charHeight,
    worldPx,
    snapRef,
    facingRef,
    spriteRef,
    stateRef,
    actorXRef,
    feetVhRef,
    sitRef,
    podiumRef,
    coverRef,
    teleportingRef,
    warmAtRef,
    setActive,
    setCharacterState,
    setMenuOpen,
    landingFor,
    openCover,
  })

  /** Al podio se va andando: solo se puede pedir teniéndolo delante, y una
   *  perla para cruzar cuatro bloques no tenía sentido. El scroll se mueve al
   *  sitio y el suavizado del mundo hace la caminata. */
  const climbPodium = useCallback(() => {
    if (teleportingRef.current || podiumRef.current > 0) return
    play('button')
    podiumFromRef.current = worldFromScroll(window.scrollY)
    podiumAskRef.current = true
    window.scrollTo({ top: scrollFromWorld(PODIUM_AT), behavior: 'auto' })
  }, [])

  const handleGreetingEnd = useCallback(() => setPhase('entering'), [])

  const sky = skyAt(night)
  const titleClass = started ? styles.titlesOut : phase === 'ready' ? styles.titlesIn : ''
  const tileWidth = (worldPx || 1080) * LAYER_ASPECT

  /** Coloca el escenario para que su sitio en el estrado caiga bajo el
   *  personaje cuando el mundo está en `PODIUM_AT`. Con `viewW` y no con
   *  `window`: de aquí sale también la posición del cofre, que sí se pinta en
   *  el servidor, y leer la ventana daba un valor distinto al hidratar. */
  const stageAnchor =
    PODIUM_AT * WORLD_LENGTH + viewW * (PODIUM_X / 100) - STAGE.anchorX * ((worldPx || 1080) / WORLD_UNIT)

  // El cofre va pegado al estrado por la izquierda, dejando el hueco justo
  // para el personaje. En el `at` de la sección caía encima del primer puesto.
  const stageScale = (worldPx || 1080) / WORLD_UNIT
  const chestLeft = stageAnchor + (STAGE.anchorX + STAGE.from - CHEST_GAP - CHEST_PX) * stageScale
  chestAtRef.current =
    (chestLeft + (CHEST_PX + CHEST_GAP / 2) * stageScale - viewW * (ENTRY_TO / 100)) / WORLD_LENGTH

  /** Coloca la tesela del acantilado para que el borde del vacío caiga justo
   *  donde se planta el personaje cuando el mundo llega a su fin. */
  const cliffAnchor =
    WORLD_LENGTH + (typeof window === 'undefined' ? 0 : window.innerWidth * (CLIFF_X / 100)) -
    CLIFF_EDGE * tileWidth

  /** Lo que comparten las tres piezas de capas: qué biomas hay montados y a
   *  qué medida se pintan. */
  const space: LayerSpace = {
    mounted,
    worldPx: worldPx || 1080,
    tileWidth,
    viewW,
    half: half || lite,
    worldAt: worldAtRef.current,
    cliffAnchor,
  }

  return (
    <main
      ref={rootRef}
      data-lite={lite ? 'true' : undefined}
      className={styles.page}
      style={
        {
          height: pageHeight,
          '--char-feet': `${feetVhRef.current * worldPx}px`,
          '--world-h': `${worldPx}px`,
          // El terreno se apaga y se enfría con la noche. Así el mismo render
          // sirve para cualquier hora sin volver a pasarlo por Mine-imator.
          // De día no lleva `hue-rotate`: a 0° no hace nada y era un paso más
          // en el filtro de cada capa, en cada frame.
          '--world-grade': `brightness(${1.1 - night * 0.62}) contrast(${1.08 - night * 0.1}) saturate(${1.06 - night * 0.5})${night > 0 ? ` hue-rotate(${night * 12}deg)` : ''}`,
          // Los comparten el cielo y la niebla de las capas.
          '--sky-top': sky.top,
          '--sky-mid': sky.mid,
          '--sky-bottom': sky.bottom,
          '--night': night,
        } as React.CSSProperties
      }
    >
      {/* Primer elemento enfocable de la página. Quien llegue con teclado o
          lector de pantalla se topa con un mundo de canvas sin contenido; esto
          es la salida, y tiene que estar antes que los cinco botones de la
          barra en vez de enterrada detrás de ellos. */}
      {cover === 'off' ? (
        <button type="button" className={styles.skip} onClick={() => openCover()}>
          Ir a la portada, con todo el contenido en texto
        </button>
      ) : null}

      {/* La página nunca navega, así que cambiar de sección era silencioso. */}
      <p className={styles.announce} aria-live="polite">
        {SECTIONS.find((section) => section.id === active)?.label ?? ''}
      </p>

      <div className={styles.stage} inert={cover !== 'off'}>
        <NightSky night={night} />

        <BackLayers space={space} farRef={farRef} midRef={midRef} nearRef={nearRef} />

        {/* La noche del modo ligero. Va sobre el mundo y bajo el personaje. */}
        <div className={styles.nightVeil} aria-hidden="true" />

        {phase === 'entering' || phase === 'ready' ? (
          <div
            ref={actorRef}
            className={`${styles.actor} ${hidden ? styles.actorGone : ''}`}
            style={{ left: phase === 'entering' ? `${ENTRY_FROM}%` : `${actorXRef.current}%` }}
          >
            <Character
              state={characterState}
              charHeight={charHeight}
              driven={!loopsByItself(characterState)}
              half={spriteHalf}
              spriteRef={spriteRef}
            />
          </div>
        ) : null}

        <GroundLayer space={space} groundRef={groundRef} />

        {/* El escenario del podio: una sola copia, plantada en la taiga. */}
        <StageProp space={space} propsRef={propsRef} stageAnchor={stageAnchor} />

        <Inventory
          title="Proyectos"
          projects={PROJECTS}
          openness={chestOpen}
          onPodium={climbPodium}
        />
        <Podium openness={podiumOpen} />
        {meter ? <PerfMeter /> : null}

        {phase === 'ready' ? <SheetWarmer charHeight={charHeight} half={spriteHalf} /> : null}
        <Book
          title="Sobre mí"
          pages={ABOUT_PAGES}
          portrait={{ src: '/avatar.png', alt: 'Vicente Araya' }}
          // En móvil la hoja es media pantalla: un párrafo por página.
          perPage={compact ? 1 : 3}
          openness={bookOpen}
        />
        <CraftingTable openness={benchOpen} />

        {/* Las secciones viajan con el suelo: son lugares, no pantallas.
            Solo las que tienen algo físico en el mundo: el libro, la mesa y el
            inventario son paneles y se dibujan aparte. */}
        <div ref={markersRef} className={styles.markers}>
          {/* El escenario entero se pulsa. Lo que avisa de ello es una medalla
              flotando a la entrada, como un objeto soltado en el juego: sobre
              el primer puesto caía bajo el cajón de proyectos y no se veía. */}
          {mounted.some((i) => SECTIONS[i].id === 'proyectos') && podiumOpen === 0 ? (
            <button
              type="button"
              className={styles.podiumHit}
              aria-label="Subir al podio"
              style={{
                left: stageAnchor + (STAGE.anchorX + STAGE.from) * stageScale,
                width: (STAGE.to - STAGE.from) * stageScale,
                height: (STAGE.first.up + 560) * stageScale,
              }}
              onClick={climbPodium}
            >
              <span
                className={styles.medal}
                style={{
                  left: -STAGE.from * stageScale,
                  bottom: (STAGE.lift + MEDAL.up) * stageScale,
                  width: MEDAL.width * stageScale,
                }}
              >
                <PodiumMedal />
                <span className={styles.medalHint}>Subir al podio</span>
              </span>
            </button>
          ) : null}
          {SECTIONS.filter((section) => section.id === 'proyectos' || section.id === 'contacto').map(
            (section) => (
              <section
                key={section.id}
                id={section.id}
                className={styles.marker}
                style={{
                  left: section.id === 'proyectos' ? chestLeft : section.at * WORLD_LENGTH,
                }}
              >
                {section.id === 'contacto' ? (
                  <Signs openness={signsOpen} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chestOpen > 0.4 ? '/textures/chest_open.webp' : '/textures/chest_closed.webp'}
                    alt=""
                    className={styles.chest}
                    style={{ width: CHEST_PX * stageScale }}
                  />
                )}
              </section>
            ),
          )}
        </div>

        {lite ? null : <Weather stateRef={weatherRef} worldDeltaRef={worldDeltaRef} />}

        {phase === 'greeting' ? (
          <div className={styles.greeter}>
            <SpriteGrid
              src={peekSrc(viewW > 0 && viewW < HALF_RES_WIDTH)}
              {...PEEK}
              scale={peekScale}
              onFinish={handleGreetingEnd}
              label="Vicente Araya asomándose y saludando"
            />
          </div>
        ) : null}

        {/* Con la portada puesta el titular es el suyo. */}
        {cover === 'off' ? (
          <div className={`${styles.titles} ${titleClass}`}>
            <h1 className={styles.name}>Vicente Araya</h1>
            <span className={styles.splash}>{splash}</span>
            <span className={styles.role}>Desarrollador full-stack</span>
          </div>
        ) : null}

        <WorldNav
          shown={phase === 'ready' && cover === 'off'}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          compact={compact}
          quiet={reduced}
          active={active}
          onNavigate={navigate}
          onCover={tpToCover}
        />

        <WorldLoader done={phase !== 'loading' || cover !== 'off'} progress={progress} />
      </div>

      <EnderPearl shot={shot} />
      <Chat request={chat} onSend={sendChat} onDone={closeChat} />
      {phase === 'ready' && cover === 'off' ? (
        <WalkPad
          walk={viewW * WALK_SCREENS * (SCROLL_LENGTH / WORLD_LENGTH)}
          run={viewW * RUN_SCREENS * (SCROLL_LENGTH / WORLD_LENGTH)}
        />
      ) : null}
      {cover === 'off' ? null : (
        <Cover leaving={cover === 'leaving'} arrives={coverArrives} onEnter={enterWorld} />
      )}
    </main>
  )
}
