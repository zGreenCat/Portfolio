'use client'

import { useEffect, type Dispatch, type SetStateAction } from 'react'

import type { CharacterState } from '@/components/Character'
import { FRAME_COUNT } from '@/components/Character'
import { loopsByItself } from '@/components/characterSheets'
import { easeFor } from '@/components/smoothing'
import { BLOCK_PX_SOURCE, WORLD_UNIT } from '@/content/layers'

import { airAt, gust } from './air'
import {
  CATCH_UP_BLOCKS,
  CLIFF_FROM,
  CLIFF_X,
  ENTRY_TO,
  GAIT_HOLD_SECONDS,
  LITE_MS,
  LITE_SAMPLE,
  MOUNT_RADIUS,
  PANEL_STEPS,
  PREWARM_DROP,
  PREWARM_RADIUS,
  SECTIONS,
  WORLD_EASE,
  WORLD_LENGTH,
  atOf,
  scrollFromWorld,
  worldFromScroll,
} from './constants'
import { advanceCycle, easePace, pickGait, stillTime } from './gait'
import { layerSrc, nearestSection, panelOpenness, quantize, sectionsNear } from './geometry'
import { stepClimb, stepSit } from './gestures'
import { PODIUM_AT, PODIUM_NEAR, PODIUM_X, STAGE, podiumPose } from './podium'
import type { Phase } from './constants'
import type { WorldRefs } from './useWorldRefs'

type Set<T> = Dispatch<SetStateAction<T>>

interface LoopDeps {
  refs: WorldRefs
  phase: Phase
  worldPx: number
  half: boolean
  lite: boolean
  writeFrame: (index: number) => void
  placeWorld: (at: number) => { index: number; blend: number; next: number }
  setCharacterState: Set<CharacterState>
  setLite: Set<boolean>
  setStarted: Set<boolean>
  setPodiumOpen: Set<number>
  setChestOpen: Set<number>
  setBookOpen: Set<number>
  setSignsOpen: Set<number>
  setBenchOpen: Set<number>
  setActive: Set<string>
  setMounted: Set<number[]>
}

/**
 * El bucle del recorrido: el scroll es una posición del mundo, no una línea
 * de tiempo. Un `requestAnimationFrame` que escribe al DOM por refs y no usa
 * estado para nada que cambie cada frame; lo que sí es estado va cuantizado.
 *
 * Qué se calcula está en los módulos de al lado (`gait`, `gestures`, `air`,
 * `geometry`). Aquí queda el orden en que pasa y lo que se escribe.
 */
export function useWorldLoop({
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
}: LoopDeps) {
  const {
    worldDeltaRef,
    actorXRef,
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
    warmRef,
    rootRef,
    spriteRef,
    actorRef,
    stateRef,
    snapRef,
    teleportingRef,
    warmAtRef,
  } = refs

  useEffect(() => {
    if (phase !== 'ready') return

    let raf = 0
    let current = 0
    let target = 0
    let stillFor = 0

    const applyState = (next: CharacterState) => {
      if (stateRef.current === next) return
      stateRef.current = next
      // Cortar el bucle CSS ya, sin esperar al re-render: si no, durante ese
      // frame la animación de reposo sigue corriendo sobre el valor que acaba
      // de escribir el bucle y arrastra el sprite entre dos celdas.
      if (!loopsByItself(next) && spriteRef.current) {
        spriteRef.current.dataset.driven = 'true'
      }
      setCharacterState(next)
    }

    const read = () => {
      target = worldFromScroll(window.scrollY)
    }

    const block = BLOCK_PX_SOURCE * (worldPx / WORLD_UNIT)
    let previous = 0
    let last = performance.now()
    /** Por dónde va la zancada, en ciclos. En ciclos y no en frames porque
     *  `run` y `walk` no tienen los mismos: el frame 12 es media zancada en
     *  una hoja y tres cuartos en la otra, y al cambiar de marcha el paso
     *  daba un salto. */
    let cycle = 0
    let pace = 0
    let gaitHeld = GAIT_HOLD_SECONDS

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (podiumLandRef.current !== null) {
        // Bajó por el otro lado del podio y el mundo sigue clavado donde subió.
        // No se recoloca de golpe —sería un corte de cámara—: él se queda donde
        // cayó y el mundo avanza hasta alcanzarlo. Mientras, la rueda no puede
        // quedarse más atrás, o no lo alcanzaría nunca.
        if (current >= podiumLandRef.current - 0.00003) {
          podiumLandRef.current = null
          podiumFocusRef.current = 0
        } else if (target < podiumLandRef.current) {
          target = podiumLandRef.current
        }
      }
      const before = current

      if (snapRef.current) {
        // La perla no camina: llega.
        snapRef.current = false
        current = target
        previous = current * WORLD_LENGTH
        // Y cancela el gesto: no tiene sentido levantarse de un sitio en el que
        // ya no estás. Sin esto el mundo se quedaba congelado en el acantilado.
        sitRef.current = 0
        sitLockRef.current = null
        sitDirRef.current = -1
        sitWantRef.current = false
        podiumRef.current = 0
        podiumDirRef.current = -1
        podiumWantRef.current = false
        catchUpRef.current = false
      } else {
        // Suavizado, sin tope: el mundo sigue al scroll y se detiene cuando
        // tú te detienes. El paso sale del tiempo del frame, no es fijo: fijo,
        // a 120 Hz el mundo respondía el doble de rápido que a 60.
        current += (target - current) * easeFor(WORLD_EASE, dt)
        if (Math.abs(target - current) < 0.00002) current = target
      }

      /*
       * El personaje se sienta y se levanta EN EL SITIO: mientras dure el gesto
       * —y mientras siga sentado— la posición del mundo queda clavada donde
       * llegó. Sin esto, al retroceder se iba hacia atrás mientras se levantaba.
       *
       * Usa el `sitRef` del frame anterior. Eso evita subir el bloque del gesto
       * por delante de `placeWorld`, que es lo que rompió el intento previo; el
       * desfase de un frame no se ve en un gesto de segundo y medio.
       */
      if (sitRef.current > 0 || podiumRef.current > 0) {
        if (sitLockRef.current === null) sitLockRef.current = current
        current = sitLockRef.current
      } else {
        // Al soltar, el scroll puede haberse ido lejos mientras el mundo estaba
        // quieto. Se marca para recuperarlo con tope en vez de de un salto.
        if (sitLockRef.current !== null && Math.abs(target - sitLockRef.current) > 0.002) {
          catchUpRef.current = true
        }
        sitLockRef.current = null
      }

      /*
       * Recuperación acotada. Sin esto el primer frame tras levantarse cierra
       * cientos de píxeles de golpe y el personaje sale disparado hacia atrás.
       * El tope va en bloques por segundo, así que no depende de la resolución.
       */
      if (catchUpRef.current) {
        const step = current - before
        const cap = (CATCH_UP_BLOCKS * block * dt) / WORLD_LENGTH
        if (Math.abs(step) > cap) current = before + Math.sign(step) * cap
        if (Math.abs(target - current) < 0.0005) catchUpRef.current = false
      }

      const worldX = current * WORLD_LENGTH
      // Capas, recortes, pies y hora del día. Lo mismo que usa el reaterrizaje.
      const { index, blend, next } = placeWorld(current)

      // Tres marchas por velocidad de avance: correr, caminar, parado.
      const travelled = worldX - previous

      // Vigilante de rendimiento. Solo mide con el mundo en marcha.
      if (!lite && Math.abs(travelled) > 0.5) {
        const sample = slowRef.current
        sample.frames += 1
        sample.total += dt * 1000
        if (sample.frames >= LITE_SAMPLE) {
          if (!liteLockRef.current && sample.total / sample.frames > LITE_MS) setLite(true)
          sample.frames = 0
          sample.total = 0
        }
      }
      worldDeltaRef.current = travelled
      const speed = dt > 0 ? Math.abs(travelled) / dt / block : 0
      previous = worldX
      pace = easePace(pace, speed, dt)
      stillFor = stillTime(stillFor, speed, dt)

      // Sentarse y subir al podio: las reglas de cada gesto están en
      // `gestures.ts`. Aquí se guarda su estado y se atiende lo que tocan fuera.
      const sit = stepSit(
        { at: sitRef.current, dir: sitDirRef.current, want: sitWantRef.current },
        current,
        target,
        dt,
      )
      sitRef.current = sit.at
      sitDirRef.current = sit.dir
      sitWantRef.current = sit.want
      const sitAt = sit.at

      const stepped = stepClimb(
        {
          at: podiumRef.current,
          dir: podiumDirRef.current,
          want: podiumWantRef.current,
          ask: podiumAskRef.current,
          ahead: podiumAheadRef.current,
        },
        { current, target, focus: podiumFocusRef.current, dt },
      )
      podiumRef.current = stepped.climb.at
      podiumDirRef.current = stepped.climb.dir
      podiumWantRef.current = stepped.climb.want
      podiumAskRef.current = stepped.climb.ask
      podiumAheadRef.current = stepped.climb.ahead
      if (stepped.arrived) sitLockRef.current = PODIUM_AT
      const podiumAt = stepped.climb.at
      const leavingAhead = stepped.leavingAhead
      if (stepped.landedAhead) {
        podiumLandRef.current =
          PODIUM_AT +
          ((STAGE.exit.x * worldPx) / WORLD_UNIT -
            (window.innerWidth * (ENTRY_TO - PODIUM_X)) / 100) /
            WORLD_LENGTH
        if (target < podiumLandRef.current) {
          window.scrollTo({ top: scrollFromWorld(podiumLandRef.current), behavior: 'auto' })
        }
      }
      const landed = podiumLandRef.current !== null
      const podiumNow = podiumPose(podiumAt, leavingAhead)
      const gesturing = sitAt > 0 || podiumAt > 0

      if (!teleportingRef.current) {
        // El retardo se cuenta en frames, no con un temporizador: dentro del
        // bucle, un setTimeout se reiniciaba en cada vuelta y no llegaba a
        // cumplirse nunca, así que se quedaba caminando para siempre.
        if (sitAt > 0) applyState('sit')
        else if (podiumAt >= 1) applyState('cheer')
        else if (podiumAt > 0) applyState('climb')
        // Quieto mientras la cámara lo alcanza: el mundo corre, pero él no.
        else if (landed) applyState('idle')
        else {
          const gait = pickGait({ now: stateRef.current, speed, pace, stillFor, held: gaitHeld })
          if (gait.state) applyState(gait.state)
          gaitHeld = gait.held
        }
      }
      gaitHeld += dt

      // La zancada sale del suelo recorrido, y cada marcha cubre lo suyo.
      // `stride` son los píxeles que avanza un ciclo completo, así que
      // worldX/stride son ciclos y ×count da el frame. Character envuelve.
      const active = stateRef.current
      cycle = advanceCycle(cycle, active, travelled, block, dt)
      if (active === 'sit') {
        // El frame lo marca la posición, no la distancia recorrida: el gesto
        // tiene principio y final, no es un ciclo.
        writeFrame(Math.min(FRAME_COUNT.sit - 1, Math.floor(sitAt * FRAME_COUNT.sit)))
      } else if (active === 'climb') {
        writeFrame(podiumNow.frame)
      } else if (!loopsByItself(active) && active !== 'throw') {
        // En reposo manda el bucle CSS: escribirle el frame lo dejaría clavado.
        // El lanzamiento lleva su propio reloj: escribirle aquí el frame de la
        // zancada, que parado no avanza, lo pisaba y el gesto no se movía.
        // El frame se cuenta sobre la hoja que el nodo enseña, que durante un
        // frame aún es la de la marcha anterior.
        const shown = spriteRef.current?.dataset.state
        const sheet = shown === 'run' || shown === 'walk' ? shown : active
        writeFrame(Math.floor(cycle * FRAME_COUNT[sheet]))
      }

      // Retroceder es darse la vuelta, no rebobinar. La banda muerta evita que
      // un temblor de rueda lo haga girar sobre sí mismo. Sentado no se gira:
      // la hoja está dibujada mirando al vacío y voltearla lo pondría de
      // espaldas al horizonte mientras se levanta.
      if (podiumAt > 0 && facingRef.current < 0) {
        // Al podio se sube de frente al escenario, aunque se llegara de vuelta.
        facingRef.current = 1
        if (spriteRef.current) spriteRef.current.style.transform = ''
      }
      if (!teleportingRef.current && !gesturing && Math.abs(travelled) > 0.6) {
        const facing = travelled < 0 ? -1 : 1
        if (facing !== facingRef.current) {
          facingRef.current = facing
          if (spriteRef.current) {
            spriteRef.current.style.transform = facing < 0 ? 'scaleX(-1)' : ''
          }
        }
      }
      setStarted(current > 0.004)

      // Se abre el encuadre al acercarse al acantilado.
      const toCliff = Math.min(1, Math.max(0, (current - CLIFF_FROM) / (1 - CLIFF_FROM)))
      // Y se cierra a la izquierda mientras está en el podio, para dejarle sitio
      // al escenario. Solo entonces: atado a la posición, quien cruzaba andando
      // veía al personaje frenar y acelerar en mitad del bioma. De camino se
      // corre al paso de lo que anda, y los dos acaban a la vez: por su cuenta
      // patinaba de lado con el mundo ya quieto. Al bajar vuelve poco a poco.
      const focused = podiumAskRef.current || podiumAt > 0 || podiumLandRef.current !== null
      const walkIn = Math.abs(podiumFromRef.current - PODIUM_AT)
      if (podiumAskRef.current && walkIn > PODIUM_NEAR) {
        podiumFocusRef.current = Math.max(
          podiumFocusRef.current,
          1 - Math.min(1, Math.abs(current - PODIUM_AT) / walkIn),
        )
      } else {
        podiumFocusRef.current += ((focused ? 1 : 0) - podiumFocusRef.current) * easeFor(0.1, dt)
        if (Math.abs(podiumFocusRef.current - (focused ? 1 : 0)) < 0.002) {
          podiumFocusRef.current = focused ? 1 : 0
        }
      }
      const wantX =
        ENTRY_TO + (CLIFF_X - ENTRY_TO) * toCliff + (PODIUM_X - ENTRY_TO) * podiumFocusRef.current
      actorXRef.current = wantX
      if (actorRef.current) {
        actorRef.current.style.left = `${wantX}%`
        // Lo que lo separa de la línea del suelo: el estrado bajo sus pies al
        // cruzarlo andando, y los saltos mientras sube.
        const scale = worldPx / WORLD_UNIT
        const onStage =
          ((window.innerWidth * (wantX - PODIUM_X)) / 100 + worldX - PODIUM_AT * WORLD_LENGTH) / scale
        const edge = Math.min(onStage - STAGE.from, STAGE.to - onStage)
        const walking = { x: 0, up: STAGE.lift * Math.min(1, Math.max(0, edge / 24)) }
        // Tras bajar por el otro lado sigue donde cayó, y lo que avanza el
        // mundo se le descuenta hasta que lo alcanza.
        const spot =
          podiumAt > 0
            ? podiumNow.spot
            : landed
              ? { x: STAGE.exit.x - (worldX - PODIUM_AT * WORLD_LENGTH) / scale, up: STAGE.exit.up }
              : walking
        actorRef.current.style.transform = `translate3d(${spot.x * scale}px,${-spot.up * scale}px,0)`
      }

      // Qué cae y con cuánta fuerza: `air.ts`. La arena, además, a rachas.
      const air = weatherRef.current
      const mix = airAt(index, next, blend)
      air.kind = mix.kind
      air.power = mix.kind === 'sand' ? mix.power * gust(now) : mix.power

      // La arena también quita visibilidad al fondo, no solo cae. Los velos son
      // del tamaño de la pantalla, así que esto es composición y no re-filtrado.
      const wantFog = 'fog' in SECTIONS[index] ? 1 : 0
      fogRef.current += (wantFog - fogRef.current) * easeFor(0.05, dt)
      const fog = quantize(fogRef.current, 24)
      if (fog !== fogWrittenRef.current) {
        fogWrittenRef.current = fog
        rootRef.current?.style.setProperty('--fog', `${fog}`)
      }

      const sand = quantize(air.kind === 'sand' ? air.power : 0, 24)
      if (sand !== sandRef.current) {
        sandRef.current = sand
        rootRef.current?.style.setProperty('--sand', `${sand}`)
      }

      // Apertura por distancia: es una función de la posición, no un
      // disparador. Así no hay estado que sincronizar ni re-disparos al volver.
      // El cajón del podio es la excepción: lo abre el gesto, no la distancia,
      // y mientras está abierto cierra el del cofre, que queda a un paso.
      const onPodium = quantize(podiumAt, PANEL_STEPS)
      setPodiumOpen(onPodium)
      setChestOpen(
        quantize(panelOpenness(chestAtRef.current, current) * (1 - podiumAt), PANEL_STEPS),
      )
      setBookOpen(quantize(panelOpenness(atOf('sobre-mi'), current), PANEL_STEPS))
      setSignsOpen(quantize(panelOpenness(atOf('contacto'), current), PANEL_STEPS))
      setBenchOpen(quantize(panelOpenness(atOf('skills'), current), PANEL_STEPS))
      setActive(nearestSection(current).id)

      // Qué biomas están montados. Solo se toca al cruzar el radio, y ese es el
      // único cambio de estado que rehace el árbol de capas.
      const near = sectionsNear(current, MOUNT_RADIUS)
      const key = near.join(',')
      if (key !== mountKeyRef.current) {
        mountKeyRef.current = key
        setMounted(near)
      }

      // Precalentado: descomprime las capas del bioma que viene y retiene la
      // imagen, para que montarla luego no cueste nada. Se sueltan pasado el
      // radio, con holgura, porque son decenas de MB cada una.
      const warm = warmRef.current
      SECTIONS.forEach((section) => {
        // El destino de un teletransporte cuenta como cercano desde que se
        // pide: hay un segundo de gesto antes del salto, y sin esto se llegaba
        // a un bioma sin decodificar, con el cielo pelado.
        const distance = Math.min(
          Math.abs(section.at - current),
          warmAtRef.current === null ? Infinity : Math.abs(section.at - warmAtRef.current),
        )
        section.kinds.forEach((kind) => {
          const src = layerSrc(section.biome, kind, half)
          if (distance < PREWARM_RADIUS) {
            if (!warm.has(src)) {
              const image = new Image()
              warm.set(src, image)
              image.src = src
              void image.decode().catch(() => {})
            }
          } else if (distance > PREWARM_DROP) {
            warm.delete(src)
          }
        })
      })

      raf = requestAnimationFrame(frame)
    }

    const onScroll = read

    read()

    // La vuelta ya dejó el mundo colocado y el documento desplazado antes de la
    // caminata; aquí solo se adopta como punto de partida.
    if (resumeRef.current !== null) {
      target = resumeRef.current
      resumeRef.current = null
      window.scrollTo({ top: scrollFromWorld(target), behavior: 'auto' })
    }

    current = target
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [phase, worldPx, half, lite, writeFrame, placeWorld])
}
