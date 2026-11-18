// Se ejecutan con `npm test`: el ejecutor de Node, que importa los `.ts` tal
// cual. Por eso lo que se prueba vive en módulos sin React ni alias `@/`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { ISLAND, LOST, SEGMENTS, frameAt, heroBox, span } from '../src/components/lostSheet.ts'

const root = new URL('..', import.meta.url)

/** Ancho y alto de un WebP, leídos de su cabecera. */
function webpSize(buffer) {
  const kind = buffer.toString('latin1', 12, 16)
  if (kind === 'VP8X') return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1]
  if (kind === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]
  }
  if (kind === 'VP8 ') return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff]
  throw new Error(`Cabecera WebP desconocida: ${kind}`)
}

const sizeOf = (path) => webpSize(readFileSync(new URL(`public${path}`, root)))

test('los tramos coinciden con los que escribe gen_fall.py', () => {
  const source = readFileSync(new URL('scripts/render/gen_fall.py', root), 'utf8')
  const line = source.match(/^SEGMENTS = \{(.+)\}$/m)
  assert.ok(line, 'gen_fall.py ya no declara SEGMENTS en una línea')
  const rendered = [...line[1].matchAll(/"(\w+)":\s*(\d+)/g)].map(([, name, count]) => [name, Number(count)])
  assert.deepEqual(rendered, Object.entries(SEGMENTS))
})

test('la hoja servida es una fila con todos los frames, y su mitad también', () => {
  assert.deepEqual(sizeOf(LOST.src), [LOST.frames * LOST.cellWidth, LOST.cellHeight])
  assert.deepEqual(sizeOf(LOST.halfSrc), [(LOST.frames * LOST.cellWidth) / 2, LOST.cellHeight / 2])
  assert.ok(sizeOf(LOST.halfSrc)[0] <= 8192, 'la mitad cabe en la textura de un móvil')
})

test('los tramos van seguidos y cubren la hoja', () => {
  assert.deepEqual(span('fall'), [0, 5])
  assert.deepEqual(span('land'), [6, 13])
  assert.deepEqual(span('look'), [14, LOST.frames - 1])
  assert.throws(() => span('vuelo'))
})

test('frameAt: el primero al 0%, el último al 100%, y fuera de la hoja falla', () => {
  assert.equal(frameAt(0), 0)
  assert.equal(frameAt(LOST.frames - 1), 100)
  assert.throws(() => frameAt(LOST.frames))
  assert.throws(() => frameAt(-1))
  assert.throws(() => frameAt(1.5))
})

test('la isla servida tiene la proporción declarada', () => {
  const [width, height] = sizeOf(ISLAND.src)
  assert.ok(Math.abs(width / height - ISLAND.width / ISLAND.height) < 0.002)
})

test('el personaje cae dentro de la isla, con los pies donde pisa', () => {
  const box = heroBox()
  const heightPct = (ISLAND.cellHeight / ISLAND.height) * 100
  const foot = box.top + (heightPct * LOST.footY) / LOST.cellHeight
  assert.ok(Math.abs(foot - (ISLAND.land.y / ISLAND.height) * 100) < 1e-9)
  assert.ok(box.left > 0 && box.left + box.width < 100)
  assert.ok(box.top > 0)
})
