'use client'

import { useRef } from 'react'

import type { CharacterState } from '@/components/Character'
import type { WeatherState } from '@/components/Weather'

import { CHAR_FEET_VH, ENTRY_TO } from './constants'
import { PODIUM_AT } from './podium'

/**
 * Las refs del mundo, juntas. Todo lo que cambia en cada frame vive en refs y
 * se escribe al DOM a mano, y lo comparten el bucle, la entrada, el
 * teletransporte y el montaje: pasadas una a una eran una treintena de
 * argumentos. Cada hook recibe el objeto entero y saca las que usa.
 *
 * El objeto es nuevo en cada render, pero las refs de dentro son siempre las
 * mismas: no va en listas de dependencias.
 */
export function useWorldRefs() {
  /** Avance del mundo en el último frame: arrastra las partículas. */
  const worldDeltaRef = useRef(0)
  /**
   * Todo lo que cambia en cada frame vive en refs y se escribe al DOM a mano.
   * Como estado de React obligaba a reconciliar el árbol entero —cuatro capas,
   * sus tiras y todas sus teselas— sesenta veces por segundo.
   */
  const worldAtRef = useRef(0)
  const actorXRef = useRef(ENTRY_TO)
  const feetVhRef = useRef(CHAR_FEET_VH)
  const weatherRef = useRef<WeatherState>({ kind: null, power: 0 })
  const mountKeyRef = useRef('0')
  /** Fuerza actual de la tormenta de arena, ya cuantizada. */
  const sandRef = useRef(-1)
  /** Niebla de distancia. Solo la llevan la nieve y el desierto; en el bosque y
   *  los cerezos el fondo se lee limpio. Se persigue con un suavizado en vez de
   *  atarla a la frontera: aparecer de golpe en la línea del bioma canta. */
  const fogRef = useRef(0)
  const fogWrittenRef = useRef(-1)
  /** Hacia dónde mira: 1 derecha, -1 izquierda. */
  const facingRef = useRef(1)
  /** Cuánto ha entrado en el gesto de sentarse, 0 a 1. Avanza por tiempo. */
  const sitRef = useRef(0)
  /** Si toca estar sentado. Cambia con histéresis, no en un solo umbral. */
  const sitWantRef = useRef(false)
  /** Sentido del gesto en curso: +1 sentándose, -1 levantándose. */
  const sitDirRef = useRef(-1)
  /** Posición del mundo congelada mientras dura el gesto, o null si no lo hay. */
  const sitLockRef = useRef<number | null>(null)
  /** Recuperando la distancia acumulada mientras el mundo estuvo congelado. */
  const catchUpRef = useRef(false)
  /** Lo mismo que `sitRef`, `sitWantRef` y `sitDirRef`, para subir al podio. */
  const podiumRef = useRef(0)
  const podiumWantRef = useRef(false)
  const podiumDirRef = useRef(-1)
  /** Posición del mundo en la que el personaje queda junto al cofre. No es una
   *  constante: el escenario crece con el alto de la pantalla y el cofre con
   *  el ancho, así que su sitio depende de las dos cosas. */
  const chestAtRef = useRef(PODIUM_AT - 0.045)
  /** Se pidió subir y aún no ha llegado. Lo pone el botón, lo consume el bucle. */
  const podiumAskRef = useRef(false)
  /** Baja hacia delante, por el tercer puesto, en vez de por donde subió. */
  const podiumAheadRef = useRef(false)
  /** Tocó suelo al otro lado: la posición del mundo que le corresponde ahí,
   *  mientras el mundo no haya llegado hasta ella. */
  const podiumLandRef = useRef<number | null>(null)
  /** Desde dónde echó a andar hacia el podio. */
  const podiumFromRef = useRef(PODIUM_AT)
  /** Cuánto se ha corrido a la izquierda para dejarle sitio al escenario. */
  const podiumFocusRef = useRef(0)
  /** Frames lentos acumulados con el mundo en marcha. */
  const slowRef = useRef({ frames: 0, total: 0 })
  /** `?lite=0`: el modo ligero no se enciende solo. Para comparar. */
  const liteLockRef = useRef(false)
  /**
   * Sección a la que volver al recargar, o null si es una visita limpia.
   *
   * El navegador restaura el scroll solo, y lo deja en el píxel exacto donde
   * estabas: si eso cae entre dos biomas, apareces plantado en la franja de la
   * frontera. Aquí se redondea a la sección más cercana para llegar a un sitio
   * que sea un lugar y no una coordenada.
   */
  const resumeRef = useRef<number | null>(null)
  /** Tiras montadas con su geometría ya leída: el recorte se reescribe en cada
   *  frame y no conviene volver a consultar el DOM para eso. */
  const stripsRef = useRef<
    { el: HTMLElement; from: number; to: number; speed: number; left: number; width: number }[]
  >([])
  /** Capas ya descomprimidas y retenidas. Sin esto, el decode de una imagen de
   *  3840×1440 caía justo al cruzar la frontera y ahí se veía el tirón. */
  const warmRef = useRef(new Map<string, HTMLImageElement>())
  const rootRef = useRef<HTMLElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const farRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const nearRef = useRef<HTMLDivElement>(null)
  const groundRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef<HTMLDivElement>(null)
  const actorRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<CharacterState>('idle')
  /** Pide al bucle que salte sin suavizado ni tope: es un teletransporte. */
  const snapRef = useRef(false)
  /** Hay un teletransporte en curso: el bucle no elige marcha ni gira. */
  const teleportingRef = useRef(false)
  /** Destino de un teletransporte en curso, para ir decodificando su bioma. */
  const warmAtRef = useRef<number | null>(null)

  return {
    teleportingRef,
    warmAtRef,
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
  }
}

export type WorldRefs = ReturnType<typeof useWorldRefs>
