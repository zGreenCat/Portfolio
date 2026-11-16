import assert from 'node:assert/strict'
import { test } from 'node:test'

import { RUN_FROM, WALK_UNTIL, walkSpeed } from '../src/components/walkSpeed.ts'

test('un toque corto anda; mantener pulsado acaba corriendo', () => {
  assert.equal(walkSpeed(0, 100, 400), 100)
  assert.equal(walkSpeed(WALK_UNTIL, 100, 400), 100)
  assert.equal(walkSpeed(RUN_FROM, 100, 400), 400)
  assert.equal(walkSpeed(5, 100, 400), 400)
})

test('entre andar y correr acelera sin saltos ni retrocesos', () => {
  let before = walkSpeed(WALK_UNTIL, 100, 400)
  for (let t = WALK_UNTIL; t <= RUN_FROM; t += 0.01) {
    const now = walkSpeed(t, 100, 400)
    assert.ok(now >= before - 1e-9, `baja en ${t}`)
    assert.ok(now - before < 20, `salta en ${t}`)
    before = now
  }
})
