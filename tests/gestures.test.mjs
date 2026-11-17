import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SIT_AT, SIT_RELEASE, SIT_SECONDS } from '../src/world/constants.ts'
import { stepClimb, stepSit } from '../src/world/gestures.ts'
import { PODIUM_AT, PODIUM_SECONDS } from '../src/world/podium.ts'

const DT = 1 / 60
const standing = { at: 0, dir: -1, want: false }
const down = { at: 0, dir: -1, want: false, ask: false, ahead: false }

/** Repite un paso hasta que el gesto llega a `until`, con tope de frames. */
function run(step, state, until) {
  let frames = 0
  while (state.at !== until) {
    state = step(state)
    frames += 1
    assert.ok(frames < 600, 'el gesto no termina')
  }
  return { state, seconds: frames * DT }
}

test('se sienta al llegar al borde, no cuando el scroll toca fondo', () => {
  // El scroll ya está al final, pero el mundo aún no ha llegado.
  assert.equal(stepSit(standing, 0.9, 1, DT).at, 0)
  assert.ok(stepSit(standing, SIT_AT, 1, DT).at > 0)
})

test('sentarse dura lo que dice su constante', () => {
  const { seconds } = run((sit) => stepSit(sit, 1, 1, DT), standing, 1)
  assert.ok(Math.abs(seconds - SIT_SECONDS) < 2 * DT, `${seconds} s`)
})

test('se levanta al irse el scroll, aunque el mundo siga congelado en el borde', () => {
  const sat = { at: 1, dir: 1, want: true }
  // `current` no se mueve mientras está sentado: mirarlo lo dejaría ahí.
  assert.equal(stepSit(sat, 1, SIT_RELEASE, DT).at, 1, 'en el umbral sigue sentado')
  const rising = stepSit(sat, 1, SIT_RELEASE - 0.01, DT)
  assert.ok(rising.at < 1)
  const { state } = run((sit) => stepSit(sit, 1, 0.5, DT), rising, 0)
  assert.equal(state.want, false)
})

test('a medio sentarse termina lo empezado aunque te vayas', () => {
  let sit = stepSit(standing, 1, 1, DT)
  for (let i = 0; i < 20; i += 1) sit = stepSit(sit, 1, 1, DT)
  const half = sit.at
  assert.ok(half > 0 && half < 1)
  sit = stepSit(sit, 1, 0.5, DT)
  assert.ok(sit.at > half, 'sigue sentándose')
  const { state } = run((s) => stepSit(s, 1, 0.5, DT), sit, 1)
  assert.ok(stepSit(state, 1, 0.5, DT).at < 1, 'y ya sentado, se levanta')
})

const here = { current: PODIUM_AT, target: PODIUM_AT, focus: 1, dt: DT }

test('al podio no se sube por pasar: hay que pedirlo', () => {
  const { climb, arrived } = stepClimb(down, here)
  assert.equal(climb.at, 0)
  assert.equal(arrived, false)
})

test('pedido y ya en el sitio, sube; y avisa de que el mundo se clava', () => {
  const { climb, arrived } = stepClimb({ ...down, ask: true }, here)
  assert.equal(arrived, true)
  assert.equal(climb.ask, false)
  assert.ok(climb.at > 0)
})

test('no arranca hasta estar a píxeles del sitio y con el encuadre corrido', () => {
  const asked = { ...down, ask: true }
  assert.equal(stepClimb(asked, { ...here, current: PODIUM_AT - 0.001 }).climb.at, 0)
  assert.equal(stepClimb(asked, { ...here, focus: 0.5 }).climb.at, 0)
  assert.equal(stepClimb(asked, { ...here, focus: 0.5 }).climb.ask, true, 'sigue pedido')
})

test('mover la rueda de camino lo cancela', () => {
  const { climb } = stepClimb({ ...down, ask: true }, { ...here, target: PODIUM_AT + 0.003 })
  assert.equal(climb.ask, false)
  assert.equal(climb.at, 0)
})

test('subir dura lo que dice su constante', () => {
  const first = stepClimb({ ...down, ask: true }, here).climb
  const { seconds } = run((climb) => stepClimb(climb, here).climb, first, 1)
  assert.ok(Math.abs(seconds - PODIUM_SECONDS) < 3 * DT, `${seconds} s`)
})

test('arriba se queda hasta que te alejas, y baja entero por donde te vas', () => {
  const up = { at: 1, dir: 1, want: true, ask: false, ahead: false }
  assert.equal(stepClimb(up, { ...here, target: PODIUM_AT + 0.01 }).climb.at, 1, 'cerca, sigue')

  const back = stepClimb(up, { ...here, target: PODIUM_AT - 0.1 })
  assert.ok(back.climb.at < 1)
  assert.equal(back.leavingAhead, false, 'hacia atrás, por donde subió')

  const ahead = stepClimb(up, { ...here, target: PODIUM_AT + 0.1 })
  assert.equal(ahead.leavingAhead, true, 'hacia delante, por el tercer puesto')
  // A medio bajar no cambia de lado aunque la rueda vuelva atrás.
  const swerve = stepClimb(ahead.climb, { ...here, target: PODIUM_AT - 0.1 })
  assert.equal(swerve.leavingAhead, true)
})

test('avisa una sola vez, al tocar suelo por delante', () => {
  let step = stepClimb(
    { at: 1, dir: 1, want: true, ask: false, ahead: false },
    { ...here, target: PODIUM_AT + 0.1 },
  )
  let landings = 0
  for (let i = 0; i < 300; i += 1) {
    if (step.landedAhead) landings += 1
    step = stepClimb(step.climb, { ...here, target: PODIUM_AT + 0.1 })
  }
  assert.equal(landings, 1)
  assert.equal(step.climb.at, 0)
})

test('bajando hacia atrás no hay aterrizaje por delante que atender', () => {
  let step = stepClimb(
    { at: 1, dir: 1, want: true, ask: false, ahead: false },
    { ...here, target: PODIUM_AT - 0.1 },
  )
  for (let i = 0; i < 300; i += 1) {
    assert.equal(step.landedAhead, false)
    step = stepClimb(step.climb, { ...here, target: PODIUM_AT - 0.1 })
  }
})
