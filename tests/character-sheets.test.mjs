import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  CELL_HEIGHT,
  CELL_WIDTH,
  SHEETS,
  STATES,
  sheetSrc,
  wantsHalfSheet,
} from '../src/components/characterSheets.ts'

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

for (const state of STATES) {
  test(`${state}: la hoja mide lo que dicen sus frames, y la mitad es su mitad`, () => {
    const frames = SHEETS[state].frames
    assert.deepEqual(webpSize(sheetSrc(state, false)), [frames * CELL_WIDTH, CELL_HEIGHT])
    assert.deepEqual(webpSize(sheetSrc(state, true)), [(frames * CELL_WIDTH) / 2, CELL_HEIGHT / 2])
  })
}

test('ninguna hoja a la mitad pasa de 8192 px, el tope de textura de muchos móviles', () => {
  for (const state of STATES) {
    const [width] = webpSize(sheetSrc(state, true))
    assert.ok(width <= 8192, `${state}@half mide ${width} px de ancho`)
  }
})

test('la mitad se sirve en portátiles y móviles, la entera solo en pantallas grandes', () => {
  // Alto de la celda en píxeles físicos: 1080p al 125%, 1080p, 1440p y 4K.
  assert.equal(wantsHalfSheet(270), true)
  assert.equal(wantsHalfSheet(282), true)
  assert.equal(wantsHalfSheet(400), true)
  assert.equal(wantsHalfSheet(594), false)
  assert.equal(wantsHalfSheet(450), false, 'justo en el umbral ya toca la entera')
})
