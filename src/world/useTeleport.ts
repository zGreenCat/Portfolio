'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { flushSync } from 'react-dom'

import { CELL_WIDTH, FRAME_COUNT, SHEET_GEOMETRY, THROW_RELEASE, type CharacterState } from '@/components/Character'
import type { ChatRequest } from '@/components/Chat'
import type { PearlThrow } from '@/components/EnderPearl'
import { pickTeleport, tpCommand, tpReply, type Teleport } from '@/components/teleport'
import { play } from '@/lib/sounds'

import { ENTRY_TO, PEARL_OF_CHARACTER, SECTIONS, THROW_MS, scrollFromWorld } from './constants'

type Section = (typeof SECTIONS)[number]

interface TeleportDeps {
  charHeight: number
  worldPx: number
  /** Pide al bucle que salte sin suavizado ni tope. */
  snapRef: RefObject<boolean>
  facingRef: RefObject<number>
  spriteRef: RefObject<HTMLDivElement | null>
  stateRef: RefObject<CharacterState>
  actorXRef: RefObject<number>
  feetVhRef: RefObject<number>
  sitRef: RefObject<number>
  podiumRef: RefObject<number>
  coverRef: RefObject<'on' | 'leaving' | 'off'>
  teleportingRef: RefObject<boolean>
  warmAtRef: RefObject<number | null>
  setHidden: Dispatch<SetStateAction<boolean>>
  setActive: Dispatch<SetStateAction<string>>
  setCharacterState: Dispatch<SetStateAction<CharacterState>>
  setMenuOpen: Dispatch<SetStateAction<boolean>>
  landingFor: (index: number) => number
  openCover: (arrives?: boolean) => void
}

/**
 * Irse de un sitio a otro sin caminar: la perla de ender, el `/tp` del chat y
 * la vuelta a la portada. Lleva su propio estado —la perla en vuelo, el chat,
 * si el personaje está sin pintar— y avisa al bucle por dos refs: que hay un
 * teletransporte en curso y a qué bioma va, para ir decodificándolo.
 */
export function useTeleport({
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
}: TeleportDeps) {
  const [shot, setShot] = useState<PearlThrow | null>(null)
  /** El chat, mientras se escribe un `/tp` y hasta que se va su respuesta. */
  const [chat, setChat] = useState<ChatRequest | null>(null)
  /** Adónde lleva el `/tp` que se está escribiendo: una sección, o la portada. */
  const chatTargetRef = useRef<{ at: number; id: string } | 'cover' | null>(null)
  /** `?tp=1` o `?tp=0`: siempre el comando, o siempre la perla. Para probar. */
  const tpForceRef = useRef<Teleport | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    if (query.get('tp') === '1') tpForceRef.current = 'chat'
    if (query.get('tp') === '0') tpForceRef.current = 'pearl'
  }, [])

  const jumpTo = useCallback((at: number, id: string) => {
    snapRef.current = true
    window.scrollTo({ top: scrollFromWorld(at), behavior: 'auto' })
    window.history.replaceState(null, '', `#${id}`)
    setActive(id)
  }, [])

  /** Lanza una perla y reaparece en `at`. */
  const pearlTo = useCallback(
    (at: number, id: string) => {
      // Segundo clic durante el vuelo: al destino y punto. Nadie espera dos veces.
      if (teleportingRef.current) {
        setShot(null)
        setChat(null)
        chatTargetRef.current = null
        teleportingRef.current = false
        setHidden(false)
        jumpTo(at, id)
        return
      }
      play('button')
      setMenuOpen(false)
      // De cara a la derecha para lanzar: la posición de la mano está medida
      // sobre la hoja sin voltear, y con el personaje girado la perla saldría
      // del lado contrario al que la dibuja.
      facingRef.current = 1
      if (spriteRef.current) spriteRef.current.style.transform = ''
      teleportingRef.current = true
      warmAtRef.current = at
      stateRef.current = 'throw'
      setCharacterState('throw')

      // La perla sale de la mano en el frame de máxima extensión, no del
      // centro del personaje: la geometría de la hoja dice dónde está.
      //
      // La celda se mide en pantalla, no se deduce. Deducida —20% del ancho,
      // pies en la línea del suelo— no sabía nada de lo que desplaza al
      // personaje: en el podio la perla salía del suelo, a un lado, y en
      // vertical el alto del mundo no es el de la ventana. Todas las hojas de
      // perfil comparten celda, así que la que haya ahora vale.
      const cell = spriteRef.current?.getBoundingClientRect()
      const sheet = SHEET_GEOMETRY.throw
      const scale = cell ? cell.width / CELL_WIDTH : charHeight / sheet.charHeight
      const cellLeft = cell
        ? cell.left
        : window.innerWidth * (actorXRef.current / 100) - sheet.centerX * scale
      const cellTop = cell
        ? cell.top
        : window.innerHeight - feetVhRef.current * worldPx - sheet.footY * scale
      const handX = cellLeft + THROW_RELEASE.handX * scale
      const handY = cellTop + THROW_RELEASE.handY * scale

      setShot({
        fromX: handX,
        fromY: handY,
        // Aterriza exactamente donde el personaje se planta: mismo eje, mismos pies.
        toX: window.innerWidth * (actorXRef.current / 100),
        toY: window.innerHeight - feetVhRef.current * worldPx,
        onCross: () => {
          // Se desvanece al salir la perla de plano, no al lanzarla: si no,
          // se queda un hueco vacío en la pantalla de origen.
          setHidden(true)
          jumpTo(at, id)
        },
        // La perla espera a que la mano llegue al frame de suelta.
        delayMs: (THROW_RELEASE.frame / FRAME_COUNT.throw) * THROW_MS,
        size: Math.max(16, Math.round(charHeight * PEARL_OF_CHARACTER)),
        // Reaparece en el impacto, con el estallido.
        onLand: () => {
          play('teleport')
          setHidden(false)
          stateRef.current = 'idle'
          setCharacterState('idle')
        },
        onEnd: () => {
          teleportingRef.current = false
          warmAtRef.current = null
          setShot(null)
        },
      })
    },
    [jumpTo, charHeight, worldPx],
  )

  /**
   * La otra forma de irse: abre el chat, escribe `/tp <sitio>` y aparece allí.
   * Sin vuelo: el personaje se deshace en partículas donde está y se rehace
   * en destino, y el salto del mundo ocurre entre una cosa y otra.
   */
  const chatTo = useCallback((at: number, section: Section, settled: boolean) => {
    play('button')
    setMenuOpen(false)
    teleportingRef.current = true
    warmAtRef.current = at
    chatTargetRef.current = { at, id: section.id }
    // Sentado o en el podio se queda como está: no hay hoja de teclear para
    // esas posturas, y levantarlo para escribir sería otro gesto.
    if (!settled) {
      stateRef.current = 'type'
      setCharacterState('type')
    }
    setChat({ key: performance.now(), command: tpCommand(section.label), reply: tpReply(section.label) })
  }, [])

  /**
   * A la portada se vuelve siempre con el comando, nunca de golpe: se deshace
   * en el mundo y se rehace en la portada, sobre su avatar. Poner la hoja
   * encima sin más se veía como un corte.
   */
  const tpToCover = useCallback(() => {
    if (teleportingRef.current || coverRef.current !== 'off') return
    play('button')
    setMenuOpen(false)
    teleportingRef.current = true
    chatTargetRef.current = 'cover'
    if (sitRef.current === 0 && podiumRef.current === 0) {
      stateRef.current = 'type'
      setCharacterState('type')
    }
    setChat({ key: performance.now(), command: tpCommand('Portada'), reply: tpReply('Portada') })
  }, [])

  const sendChat = useCallback(() => {
    const target = chatTargetRef.current
    if (!target) return
    chatTargetRef.current = null
    const cell = spriteRef.current?.getBoundingClientRect()
    const sheet = SHEET_GEOMETRY.idle
    const scale = cell ? cell.width / CELL_WIDTH : charHeight / sheet.charHeight
    const middle = (sheet.footY - sheet.charHeight / 2) * scale
    const shot: PearlThrow = {
      blink: true,
      fromX: cell ? cell.left + sheet.centerX * scale : window.innerWidth * (actorXRef.current / 100),
      fromY: cell ? cell.top + middle : window.innerHeight - feetVhRef.current * worldPx - charHeight / 2,
      toX: window.innerWidth * (ENTRY_TO / 100),
      toY: window.innerHeight - feetVhRef.current * worldPx - charHeight / 2,
      size: Math.max(16, Math.round(charHeight * PEARL_OF_CHARACTER)),
      onCross: () => {
        setHidden(true)
        if (target !== 'cover') {
          jumpTo(target.at, target.id)
          return
        }
        // La portada tiene que estar montada ya: el segundo estallido cae
        // sobre su avatar, y dónde está solo se sabe midiéndolo.
        flushSync(() => openCover(true))
        setChat(null)
        const avatar = document.querySelector('[data-cover-avatar]')?.getBoundingClientRect()
        if (avatar) {
          shot.toX = avatar.left + avatar.width / 2
          shot.toY = avatar.top + avatar.height * 0.45
        }
      },
      onLand: () => {
        play('teleport')
        // En la portada se queda sin pintar hasta que se vuelva a entrar: en
        // vertical el mundo va debajo del papel y asomaba junto a la foto.
        if (target !== 'cover') setHidden(false)
        stateRef.current = 'idle'
        setCharacterState('idle')
      },
      onEnd: () => {
        teleportingRef.current = false
        warmAtRef.current = null
        setShot(null)
      },
    }
    setShot(shot)
  }, [jumpTo, openCover, charHeight, worldPx])

  const closeChat = useCallback(() => setChat(null), [])

  const navigate = useCallback(
    (section: Section) => {
      const at = landingFor(SECTIONS.indexOf(section))
      const settled = sitRef.current > 0 || podiumRef.current > 0
      const how = teleportingRef.current
        ? 'pearl'
        : pickTeleport({ settled, roll: Math.random(), force: tpForceRef.current })
      if (how === 'chat') chatTo(at, section, settled)
      else pearlTo(at, section.id)
    },
    [pearlTo, chatTo, landingFor],
  )

  return {
    shot,
    chat,
    navigate,
    tpToCover,
    sendChat,
    closeChat,
  }
}
