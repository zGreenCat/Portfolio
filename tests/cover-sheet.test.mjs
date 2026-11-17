import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { DUO, framePosition, gazeFrame, wantsHalfDuo } from '../src/components/coverSheet.ts'

const root = new URL('..', import.meta.url)

/** Ancho y alto de un WebP, leídos de su cabecera. */
function webpSize(path) {
  const buffer = readFileSync(new URL(`public${path}`, root))
  const kind = buffer.toString('latin1', 12, 16)
  if (kind === 'VP8X') return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1]
  if (kind === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]
  }
  if (kind === 'VP8 ') return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff]
  throw new Error(`Cabecera WebP desconocida en ${path}: ${kind}`)
}

test('la hoja de la portada mide lo que dicen sus poses', () => {
  assert.deepEqual(webpSize(DUO.src), [DUO.frames * DUO.cellWidth, DUO.cellHeight])
})

test('la mitad de la hoja es su mitad, redondeada', () => {
  const [width, height] = webpSize(DUO.halfSrc)
  assert.ok(Math.abs(width - (DUO.frames * DUO.cellWidth) / 2) <= 1, `mide ${width} de ancho`)
  assert.ok(Math.abs(height - DUO.cellHeight / 2) <= 1, `mide ${height} de alto`)
})

test('la foto de la portada existe', () => {
  assert.ok(existsSync(new URL('public/vicente.webp', root)))
})

test('la mirada sigue al puntero y no pasa de los extremos', () => {
  assert.equal(gazeFrame(500, 500, 300), 2, 'de frente')
  assert.equal(gazeFrame(200, 500, 300), 0, 'del todo a la izquierda')
  assert.equal(gazeFrame(-4000, 500, 300), 0)
  assert.equal(gazeFrame(800, 500, 300), 4, 'del todo a la derecha')
  assert.equal(gazeFrame(9000, 500, 300), 4)
  assert.equal(gazeFrame(650, 500, 300), 3)
})

test('una mirada nunca cae en una pose de parpadeo', () => {
  for (let x = -2000; x <= 4000; x += 37) {
    assert.ok(gazeFrame(x, 500, 300) < DUO.halfShut)
  }
})

test('un alcance que no es positivo es un error, no una mirada', () => {
  assert.throws(() => gazeFrame(10, 0, 0))
})

test('cada pose tiene su sitio en la hoja y las de fuera fallan', () => {
  assert.equal(framePosition(0), '0%')
  assert.equal(framePosition(DUO.shut), '100%')
  assert.equal(framePosition(3), '50%')
  assert.throws(() => framePosition(DUO.frames))
  assert.throws(() => framePosition(1.5))
})

test('la mitad se sirve salvo en pantallas grandes', () => {
  assert.equal(wantsHalfDuo(528), true)
  assert.equal(wantsHalfDuo(713), false)
})
