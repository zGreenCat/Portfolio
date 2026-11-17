import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FRAME_COUNT } from '../src/components/characterSheets.ts'
import {
  GAIT_HOLD_SECONDS,
  IDLE_SECONDS,
  SPEED_RUN,
  SPEED_RUN_OFF,
  SPEED_WALK,
} from '../src/world/constants.ts'
import { advanceCycle, easePace, pickGait, stillTime } from '../src/world/gait.ts'

/**
 * Pasa una serie de velocidades por la marcha, como hace el bucle de la
 * página, y devuelve la hoja de cada frame.
 */
function walkThrough(speeds, hz) {
  const dt = 1 / hz
  let state = 'idle'
  let pace = 0
  let stillFor = 0
  let held = GAIT_HOLD_SECONDS
  const states = []
  for (const speed of speeds) {
    pace = easePace(pace, speed, dt)
    stillFor = stillTime(stillFor, speed, dt)
    const gait = pickGait({ now: state, speed, pace, stillFor, held })
    if (gait.state) state = gait.state
    held = gait.held + dt
    states.push(state)
  }
  return states
}

const changes = (states) => states.filter((state, i) => i > 0 && state !== states[i - 1]).length

/** Golpes de rueda: un pico de 13 bloques por segundo que se apaga en un
 *  cuarto de segundo, uno cada `every` segundos. */
function wheel(seconds, every, hz) {
  const speeds = []
  for (let i = 0; i < seconds * hz; i += 1) {
    const since = (i / hz) % every
    speeds.push(13 * Math.exp(-since / 0.07))
  }
  return speeds
}

for (const hz of [60, 120]) {
  test(`${hz} Hz: la rueda lenta no hace parpadear la marcha`, () => {
    // Eran 26 cambios en 4 s: cada golpe era correr, caminar y parar.
    const states = walkThrough(wheel(4, 0.6, hz), hz)
    assert.ok(changes(states) <= 14, `${changes(states)} cambios`)
    assert.ok(!states.includes('run'), 'golpes sueltos no son correr')
  })

  test(`${hz} Hz: golpes seguidos son correr, sin soltarlo entre golpe y golpe`, () => {
    const states = walkThrough(wheel(4, 0.12, hz), hz)
    const settled = states.slice(hz)
    assert.ok(settled.every((state) => state === 'run'), 'pasado el primer segundo, corre')
    assert.ok(changes(states) <= 3, `${changes(states)} cambios`)
  })
}

test('la marcha dura lo mismo a 60 que a 120 Hz', () => {
  const at60 = walkThrough(wheel(4, 0.12, 60), 60)
  const at120 = walkThrough(wheel(4, 0.12, 120), 120)
  const share = (states) => states.filter((state) => state === 'run').length / states.length
  assert.ok(Math.abs(share(at60) - share(at120)) < 0.03)
})

test('parado no arranca, y al frenar espera lo justo antes del reposo', () => {
  assert.equal(pickGait({ now: 'idle', speed: 0, pace: 0, stillFor: 0, held: 1 }).state, null)
  const braking = { now: 'run', speed: 0, pace: 3, held: 1 }
  assert.equal(pickGait({ ...braking, stillFor: IDLE_SECONDS - 0.01 }).state, null)
  assert.equal(pickGait({ ...braking, stillFor: IDLE_SECONDS }).state, 'idle')
})

test('desde parado arranca en la marcha que toque, sin esperar', () => {
  const start = { now: 'idle', stillFor: 0, held: 0 }
  assert.equal(pickGait({ ...start, speed: 1, pace: 1 }).state, 'walk')
  assert.equal(pickGait({ ...start, speed: 5, pace: SPEED_RUN + 0.1 }).state, 'run')
})

test('dejar de correr pide bajar más de lo que costó arrancar', () => {
  const between = (SPEED_RUN + SPEED_RUN_OFF) / 2
  const settled = { speed: between, pace: between, stillFor: 0, held: 1 }
  assert.equal(pickGait({ ...settled, now: 'run' }).state, null, 'corriendo, sigue')
  assert.equal(pickGait({ ...settled, now: 'walk' }).state, null, 'caminando, sigue')
  assert.equal(pickGait({ ...settled, now: 'run', pace: SPEED_RUN_OFF - 0.1 }).state, 'walk')
})

test('una marcha recién cambiada no vuelve a cambiar hasta asentarse', () => {
  const fast = { now: 'walk', speed: 5, pace: 5, stillFor: 0 }
  assert.equal(pickGait({ ...fast, held: GAIT_HOLD_SECONDS - 0.01 }).state, null)
  assert.equal(pickGait({ ...fast, held: GAIT_HOLD_SECONDS }).state, 'run')
})

test('el tiempo parado se acumula por debajo del umbral y se borra por encima', () => {
  assert.equal(stillTime(0.2, SPEED_WALK, 0.1), 0.30000000000000004)
  assert.equal(stillTime(0.2, SPEED_WALK + 0.01, 0.1), 0)
})

test('al frenar la zancada sigue avanzando: no se queda clavado en una pose', () => {
  const dt = 1 / 60
  assert.ok(advanceCycle(0.3, 'run', 0, 100, dt) > 0.3)
  assert.ok(advanceCycle(0.3, 'walk', 0, 100, dt) > 0.3)
  assert.equal(advanceCycle(0.3, 'idle', 0, 100, dt), 0.3)
})

test('un golpe fuerte no dispara la zancada, y retroceder no la rebobina', () => {
  const dt = 1 / 60
  const burst = advanceCycle(0, 'run', 5000, 100, dt)
  assert.ok(burst <= (34 * dt) / FRAME_COUNT.run + 1e-9)
  assert.equal(advanceCycle(0.2, 'walk', -40, 100, dt), advanceCycle(0.2, 'walk', 40, 100, dt))
})

test('la zancada da la vuelta y no se sale de 0…1', () => {
  let cycle = 0.99
  for (let i = 0; i < 200; i += 1) {
    cycle = advanceCycle(cycle, 'run', 30, 100, 1 / 60)
    assert.ok(cycle >= 0 && cycle < 1)
  }
})
