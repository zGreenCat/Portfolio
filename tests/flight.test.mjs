import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { SHEETS } from '../src/components/characterSheets.ts'
import {
  FIRE_FRAME,
  FLIGHT_MS,
  GLIDE_FRAMES,
  PREP_MS,
  TAKE_OFF_FRAMES,
  flightFrame,
  flightOffset,
  flightProgress,
} from '../src/world/flight.ts'

test('la hoja de vuelo tiene las poses que el gesto cuenta', () => {
  assert.equal(SHEETS.fly.frames, TAKE_OFF_FRAMES + GLIDE_FRAMES)
})

test('el generador enciende el cohete en la misma pose que la página', () => {
  const source = readFileSync(new URL('../scripts/render/gen_fly.py', import.meta.url), 'utf8')
  assert.match(source, new RegExp(`^FIRE = ${FIRE_FRAME}$`, 'm'))
  assert.match(source, new RegExp(`^TAKE_OFF, GLIDE = ${TAKE_OFF_FRAMES}, ${GLIDE_FRAMES}$`, 'm'))
})

test('primero recorre el despegue, una vez, y luego planea en bucle', () => {
  assert.equal(flightFrame(0), 0)
  assert.equal(flightFrame(PREP_MS - 1), TAKE_OFF_FRAMES - 1)
  assert.equal(flightFrame(PREP_MS), TAKE_OFF_FRAMES)
  let before = -1
  for (let ms = 0; ms < PREP_MS; ms += 10) {
    const frame = flightFrame(ms)
    assert.ok(frame >= before, 'el despegue no retrocede')
    before = frame
  }
  for (let ms = PREP_MS; ms < PREP_MS + 5000; ms += 13) {
    const frame = flightFrame(ms)
    assert.ok(frame >= TAKE_OFF_FRAMES && frame < TAKE_OFF_FRAMES + GLIDE_FRAMES)
  }
})

test('un tiempo negativo no da una pose negativa', () => {
  assert.equal(flightFrame(-40), 0)
})

test('no se mueve del sitio hasta despegar, y al acabar ha salido de la pantalla', () => {
  assert.equal(flightProgress(PREP_MS / 2), 0)
  assert.deepEqual(flightOffset(flightProgress(PREP_MS), 900, 600), { x: 0, y: -0 })
  assert.equal(flightProgress(PREP_MS + FLIGHT_MS), 1)
  const end = flightOffset(1, 900, 600)
  assert.equal(end.x, 900)
  assert.ok(Math.abs(end.y + 600) < 1e-9)
})

test('sube y avanza sin volver atrás, y sube antes de lo que avanza', () => {
  let before = { x: 0, y: 0 }
  for (let u = 0.02; u <= 1; u += 0.02) {
    const now = flightOffset(u, 900, 600)
    assert.ok(now.x >= before.x && now.y <= before.y)
    before = now
  }
  const early = flightOffset(0.3, 900, 900)
  assert.ok(-early.y > early.x)
})
