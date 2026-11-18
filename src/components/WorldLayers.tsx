'use client'

import { Fragment, type RefObject } from 'react'

import styles from '@/app/recorrido.module.css'
import { LAYER_HEIGHT, WORLD_UNIT } from '@/content/layers'
import { CLIFF_EDGE, LAYER_SPEED, SECTIONS, WORLD_LENGTH, type Kind } from '@/world/constants'
import { BOUNDS, clearingPhase } from '@/world/geometry'

import Strip from './ParallaxLayer'
import layerStyles from './ParallaxLayer.module.css'

/** Lo que comparten las piezas de capas: qué biomas hay montados y a qué
 *  medida se pintan. Lo calcula la página, que es quien conoce la ventana. */
export interface LayerSpace {
  /** Índices de las secciones montadas. */
  mounted: number[]
  /** Alto de la caja del mundo, en píxeles de pantalla. */
  worldPx: number
  tileWidth: number
  viewW: number
  /** Capas a media resolución. */
  half: boolean
  /** Posición del mundo al pintar, de 0 a 1. */
  worldAt: number
  /** Dónde va anclada la tesela del acantilado. */
  cliffAnchor: number
}

/** Cada capa conserva su alto propio: se recortaron por arriba hasta donde
 *  empieza su contenido, así que la de los árboles sobresale de la caja del
 *  mundo y la del suelo pelado no arrastra cielo vacío. */
const heightOf = (space: LayerSpace, name: string) =>
  (space.worldPx * (LAYER_HEIGHT[name] ?? WORLD_UNIT)) / WORLD_UNIT

/**
 * Bordes del territorio de un bioma, en píxeles del contenedor de su capa.
 *
 * Lleva el término `-worldX*(1-speed)` para que la frontera caiga en la
 * MISMA x de pantalla en todas las capas. Sin él, cada capa cortaba el bioma
 * en un sitio distinto —el fondo mucho antes que el suelo— y se veía taiga
 * detrás de bosque. La frontera es una línea vertical que se cruza andando,
 * y detrás de ella el parallax sigue funcionando con normalidad.
 */
const spanOf = (space: LayerSpace, i: number, speed: number) => ({
  spanFrom: BOUNDS[i].from === -Infinity ? -Infinity : BOUNDS[i].from * WORLD_LENGTH,
  spanTo: BOUNDS[i].to === Infinity ? Infinity : BOUNDS[i].to * WORLD_LENGTH,
  shift: space.worldAt * WORLD_LENGTH * (1 - speed),
})

/** Centra una tesela en la pantalla justo al llegar a su sección. Lo usan
 *  los elementos que son un LUGAR y no una textura repetible. */
const centredAnchor = (at: number, speed: number, width: number) =>
  at * WORLD_LENGTH * speed +
  (typeof window === 'undefined' ? 0 : window.innerWidth / 2) -
  width / 2

type BoxRef = RefObject<HTMLDivElement | null>

/** Las tres capas del fondo, cada una con su niebla y su tinte de tormenta. */
export function BackLayers({
  space,
  farRef,
  midRef,
  nearRef,
}: {
  space: LayerSpace
  farRef: BoxRef
  midRef: BoxRef
  nearRef: BoxRef
}) {
  const { mounted, tileWidth, viewW, half, cliffAnchor } = space
  return (
    <>
      {(['far', 'mid', 'near'] as Kind[]).map((kind) => (
        <Fragment key={kind}>
        <div
          ref={kind === 'far' ? farRef : kind === 'mid' ? midRef : nearRef}
          className={`${layerStyles.box} ${styles[kind]}`}
        >
          {mounted
            .filter((i) => (SECTIONS[i].kinds as readonly string[]).includes(kind))
            .map((i) => SECTIONS[i])
            .map((s) => (
            <Strip
              key={s.biome}
              src={`/layers/${s.biome}_${kind}.webp`}
              travel={WORLD_LENGTH * LAYER_SPEED[kind]}
              tileWidth={tileWidth}
              tileHeight={heightOf(space, `${s.biome}_${kind}`)}
              speed={LAYER_SPEED[kind]}
              viewport={viewW}
              {...spanOf(space, SECTIONS.indexOf(s), LAYER_SPEED[kind])}
              half={half}
              extend={s.biome === 'b5' ? 2 : 0}
              // La capa de árboles de los cerezos también se corre. Su
              // recorte no cae siempre en el mismo punto de la tira —va a
              // otro ritmo que el suelo y se desliza al andar—, así que se
              // centra el claro en mitad de ese deslizamiento: cabe entero.
              phase={
                s.biome === 'b4' && kind === 'near'
                  ? clearingPhase(
                      BOUNDS[SECTIONS.indexOf(s)].to * WORLD_LENGTH * LAYER_SPEED[kind] +
                        (viewW * (1 - LAYER_SPEED[kind])) / 2,
                      tileWidth,
                    )
                  : 0
              }
              anchor={
                s.biome === 'b5'
                  ? cliffAnchor * LAYER_SPEED[kind]
                  : 'anchored' in s && s.anchored.includes(kind)
                    ? centredAnchor(s.at, LAYER_SPEED[kind], tileWidth)
                    : undefined
              }
            />
          ))}
        </div>
        {/* Niebla de distancia y tinte de tormenta, entre esta capa y la
            siguiente. Cada uno con su fuerza y sus biomas. */}
        <div
          className={`${styles.scrim} ${
            kind === 'far' ? styles.fogFar : kind === 'mid' ? styles.fogMid : styles.fogNear
          }`}
          aria-hidden="true"
        />
        <div
          className={`${styles.scrim} ${
            kind === 'far' ? styles.sandFar : kind === 'mid' ? styles.sandMid : styles.sandNear
          }`}
          aria-hidden="true"
        />
        </Fragment>
      ))}
    </>
  )
}

/** El suelo. Va aparte de las demás capas: el personaje se pinta entre medias. */
export function GroundLayer({ space, groundRef }: { space: LayerSpace; groundRef: BoxRef }) {
  const { mounted, tileWidth, viewW, half, cliffAnchor } = space
  return (
    <div ref={groundRef} className={`${layerStyles.box} ${styles.ground}`}>
      {mounted.map((i) => SECTIONS[i]).map((s) => (
        <Strip
          key={s.biome}
          src={`/layers/${s.biome}_ground.webp`}
          travel={WORLD_LENGTH}
          tileWidth={tileWidth}
          tileHeight={heightOf(space, `${s.biome}_ground`)}
          speed={LAYER_SPEED.ground}
          viewport={viewW}
          {...spanOf(space, SECTIONS.indexOf(s), LAYER_SPEED.ground)}
          half={half}
          // El suelo del acantilado acaba en el cantil: sus copias extra
          // se encadenan por el terreno, no por la tesela entera.
          extend={s.biome === 'b5' ? 4 : 0}
          solid={s.biome === 'b5' ? CLIFF_EDGE : undefined}
          anchor={s.biome === 'b5' ? cliffAnchor : undefined}
          // Los cerezos, que acaban contra el acantilado: se corren para
          // que esa frontera caiga en su claro y no parta un árbol.
          phase={
            s.biome === 'b4'
              ? clearingPhase(BOUNDS[SECTIONS.indexOf(s)].to * WORLD_LENGTH, tileWidth)
              : 0
          }
        />
      ))}
    </div>
  )
}

/** El escenario del podio: una sola copia, plantada en la taiga. */
export function StageProp({
  space,
  propsRef,
  stageAnchor,
}: {
  space: LayerSpace
  propsRef: BoxRef
  stageAnchor: number
}) {
  const { mounted, tileWidth, viewW, half } = space
  return (
    <div ref={propsRef} className={`${layerStyles.box} ${styles.props}`}>
      {mounted
        .map((i) => SECTIONS[i])
        .filter((s) => s.id === 'proyectos')
        .map((s) => (
          <Strip
            key="stage"
            src="/layers/b2_stage.webp"
            travel={WORLD_LENGTH}
            tileWidth={tileWidth}
            tileHeight={heightOf(space, 'b2_stage')}
            speed={LAYER_SPEED.ground}
            viewport={viewW}
            {...spanOf(space, SECTIONS.indexOf(s), LAYER_SPEED.ground)}
            half={half}
            anchor={stageAnchor}
          />
        ))}
    </div>
  )
}
