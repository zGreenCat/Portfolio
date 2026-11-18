// Se ejecutan con `npm test`: el ejecutor de Node, que importa los `.ts` tal
// cual. Por eso lo que se prueba vive en módulos sin React ni alias `@/`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { frameAt } from '../src/components/spriteFrames.ts'
import { SEGMENTS, WATCH, segment } from '../src/components/watchSheet.ts'

const root = new URL('..', import.meta.url)
const total = Object.values(SEGMENTS).reduce((sum, count) => sum + count, 0)

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

test('los tramos coinciden con los que escribe gen_watch.py', () => {
  const source = readFileSync(new URL('scripts/render/gen_watch.py', root), 'utf8')
  const line = source.match(/^SEGMENTS = \{(.+)\}$/m)
  assert.ok(line, 'gen_watch.py ya no declara SEGMENTS en una línea')
  const rendered = Object.fromEntries(
    [...line[1].matchAll(/"(\w+)":\s*(\d+)/g)].map(([, name, count]) => [name, Number(count)]),
  )
  assert.deepEqual(rendered, { ...SEGMENTS })
  assert.deepEqual(Object.keys(rendered), Object.keys(SEGMENTS), 'el orden de los tramos también cuenta')
})

test('la hoja servida tiene sitio para todos los frames y celdas enteras', () => {
  const [width, height] = webpSize(readFileSync(new URL(`public${WATCH.src}`, root)))
  assert.ok(WATCH.columns * WATCH.rows >= total, 'la rejilla declarada no da para todos los frames')
  assert.equal(width % WATCH.columns, 0)
  assert.equal(height % WATCH.rows, 0)
  assert.equal(
    width / WATCH.columns / (height / WATCH.rows),
    WATCH.cellWidth / WATCH.cellHeight,
    'la celda servida no tiene la proporción de la declarada',
  )
})

test('la hoja a la mitad, la de pantallas estrechas, es la entera a la mitad', () => {
  const [width, height] = webpSize(readFileSync(new URL(`public${WATCH.src}`, root)))
  const [halfWidth, halfHeight] = webpSize(readFileSync(new URL(`public${WATCH.halfSrc}`, root)))
  assert.deepEqual([halfWidth, halfHeight], [width / 2, height / 2])
  assert.ok(halfWidth <= 4096, 'cabe en la textura de un móvil')
})

test('los tramos van seguidos y sin solaparse', () => {
  const all = Object.keys(SEGMENTS).flatMap((name) => segment(name))
  assert.deepEqual(all, Array.from({ length: total }, (_, i) => i))
  assert.throws(() => segment('salto'))
})

test('el bucle no repite la entrada ni se sale de la hoja', () => {
  for (const frame of WATCH.loop) {
    assert.ok(frame >= SEGMENTS.intro && frame < total, `frame ${frame} fuera del bucle`)
  }
  assert.equal(WATCH.frames, SEGMENTS.intro)
})

test('todo gesto sale del reposo y vuelve a él, sin dos gestos seguidos', () => {
  const rest = segment('rest')
  const loop = WATCH.loop
  for (const name of ['point', 'wonder']) {
    const gesture = segment(name)
    const starts = loop.flatMap((frame, at) => (frame === gesture[0] ? [at] : []))
    assert.ok(starts.length > 0, `el bucle nunca hace «${name}»`)
    for (const at of starts) {
      assert.deepEqual(loop.slice(at, at + gesture.length), gesture, `«${name}» no se reproduce entero`)
      assert.equal(loop.at(at - 1), rest.at(-1), `«${name}» no arranca desde el reposo`)
      assert.equal(loop[(at + gesture.length) % loop.length], rest[0], `tras «${name}» no vuelve al reposo`)
    }
  }
  assert.equal(loop[0], rest[0], 'tras la entrada toca mirar, no un gesto')
})

test('frameAt: entrada de corrido y luego el bucle, dando la vuelta', () => {
  const loop = [7, 8, 9]
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map((step) => frameAt(step, 2, loop)), [0, 1, 7, 8, 9, 7, 8, 9])
})

test('frameAt: sin bucle se queda en el último frame', () => {
  assert.deepEqual([0, 3, 4, 99].map((step) => frameAt(step, 4)), [0, 3, 3, 3])
  assert.equal(frameAt(9, 4, []), 3)
  assert.equal(frameAt(-1, 4), 0)
})
