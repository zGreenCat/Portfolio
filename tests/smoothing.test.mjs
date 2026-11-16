import assert from 'node:assert/strict'
import { test } from 'node:test'

import { easeFor } from '../src/components/smoothing.ts'

/** Lo que queda por recorrer tras `seconds`, a `hz` frames por segundo. */
function remaining(perFrame, hz, seconds) {
  let left = 1
  for (let i = 0; i < Math.round(hz * seconds); i += 1) left *= 1 - easeFor(perFrame, 1 / hz)
  return left
}

test('a 60 Hz es el número de siempre', () => {
  assert.ok(Math.abs(easeFor(0.12, 1 / 60) - 0.12) < 1e-12)
})

test('recorre lo mismo en el mismo tiempo a 30, 60, 120 y 144 Hz', () => {
  const at60 = remaining(0.12, 60, 0.5)
  for (const hz of [30, 120, 144]) {
    assert.ok(Math.abs(remaining(0.12, hz, 0.5) - at60) < 1e-9, `${hz} Hz se desvía`)
  }
})

test('sin tiempo no se mueve, y nunca se pasa del destino', () => {
  assert.equal(easeFor(0.12, 0), 0)
  assert.ok(easeFor(0.12, 0.05) < 1)
  assert.ok(easeFor(0.12, 10) <= 1)
})
