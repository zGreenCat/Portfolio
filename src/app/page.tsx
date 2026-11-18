'use client'

import { useCallback, useEffect, useState } from 'react'

import Character, { type CharacterState } from '@/components/Character'
import { loopsByItself } from '@/components/characterSheets'
import Chat from '@/components/Chat'
import EnderPearl from '@/components/EnderPearl'
import Book from '@/components/Book'
import CraftingTable from '@/components/CraftingTable'
import Inventory from '@/components/Inventory'
import PerfMeter from '@/components/PerfMeter'
import Podium, { PodiumMedal } from '@/components/Podium'
import WalkPad from '@/components/WalkPad'
import Cover from '@/components/Cover'
import NightSky, { skyAt } from '@/components/NightSky'
import Signs from '@/components/Signs'
import { WORLD_UNIT } from '@/content/layers'
import Weather from '@/components/Weather'
import { play } from '@/lib/sounds'
import { ABOUT_PAGES, PROJECTS } from '@/content/portfolio'
import { BackLayers, GroundLayer, StageProp, type LayerSpace } from '@/components/WorldLayers'
import { SheetWarmer, WorldLoader, WorldNav } from '@/components/WorldChrome'
import SpriteGrid from '@/components/SpriteGrid'

import {
  CLIFF_EDGE,
  CLIFF_X,
  ENTRY_FROM,
  ENTRY_TO,
  HALF_RES_WIDTH,
  LAYER_ASPECT,
  PEEK,
  RUN_SCREENS,
  SCROLL_LENGTH,
  SECTIONS,
  SPLASHES,
  WALK_SCREENS,
  WORLD_LENGTH,
  peekSrc,
  scrollFromWorld,
  worldFromScroll,
} from '@/world/constants'
import { CHEST_GAP, CHEST_PX, MEDAL, PODIUM_AT, PODIUM_X, STAGE } from '@/world/podium'

import { useBackgroundFetch } from '@/world/useLoading'
import { useTeleport } from '@/world/useTeleport'
import { useWorldRefs } from '@/world/useWorldRefs'
import { useWorldLoop } from '@/world/useWorldLoop'
import { useViewport } from '@/world/useViewport'
import { useSprite } from '@/world/useSprite'
import { usePlacement } from '@/world/usePlacement'
import { useEntry } from '@/world/useEntry'
import type { Phase } from '@/world/constants'

import styles from './recorrido.module.css'



export default function RecorridoPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const { worldPx, viewW, half, spriteHalf, compact, charHeight, peekScale, pageHeight } =
    useViewport()
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
  const [characterState, setCharacterState] = useState<CharacterState>('idle')
  const [started, setStarted] = useState(false)
  const [splash, setSplash] = useState(SPLASHES[0])
  const [active, setActive] = useState<string>('inicio')
  const [chestOpen, setChestOpen] = useState(0)
  const [bookOpen, setBookOpen] = useState(0)
  const [signsOpen, setSignsOpen] = useState(0)
  const [benchOpen, setBenchOpen] = useState(0)
  /** Si el sistema pide menos movimiento, la versión en texto deja de ser un
   *  enlace más de la barra y se señala: ya dijeron que no quieren esto. */
  const [reduced, setReduced] = useState(false)
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


  useEffect(() => setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]), [])
  useEffect(() => setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches), [])

  const writeFrame = useSprite({ refs, worldPx, characterState, setCharacterState })

  /** El personaje sin pintar: en mitad de un teletransporte, o bajo la portada. */
  const [hidden, setHidden] = useState(false)
  const { cover, coverRef, coverArrives, landingFor, enterWorld, openCover, progress } = useEntry({
    refs,
    phase,
    setPhase,
    setMounted,
    setActive,
    setHidden,
  })


  const { placeWorld, night } = usePlacement({
    refs,
    phase,
    setPhase,
    worldPx,
    viewW,
    half,
    mounted,
    writeFrame,
    setCharacterState,
  })


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
    setHidden,
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
