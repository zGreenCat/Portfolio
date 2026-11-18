// Se ejecutan con `npm test`: el ejecutor de Node, que importa los `.ts` tal
// cual. Por eso lo que se prueba vive en módulos sin React ni alias `@/`.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { SHEETS } from '../src/components/characterSheets.ts'
import { LOST, span } from '../src/components/lostSheet.ts'
import { ARRIVAL_KEY, FALL_MS, FLAIL_MS, LAND_MS, fallPose, readArrival } from '../src/world/fallIn.ts'

const root = new URL('..', import.meta.url)

test('empieza arriba, fuera de la pantalla, y agitando los brazos', () => {
  const pose = fallPose(0)
  assert.equal(pose.lift, 1)
  assert.equal(pose.frame, span('fall')[0])
  assert.equal(pose.done, false)
  assert.deepEqual(fallPose(-50), pose, 'un tiempo negativo no lo saca de la hoja')
})

test('baja sin volver a subir, y cada vez más rápido', () => {
  let last = 1
  let lastStep = 0
  for (let ms = 50; ms < FALL_MS; ms += 50) {
    const { lift } = fallPose(ms)
    assert.ok(lift < last, `a los ${ms} ms sube`)
    assert.ok(last - lift > lastStep, `a los ${ms} ms frena`)
    lastStep = last - lift
    last = lift
  }
})

test('mientras cae solo usa las poses de caer, y las recorre todas', () => {
  const [from, to] = span('fall')
  const seen = new Set()
  for (let ms = 0; ms < FALL_MS; ms += FLAIL_MS / 2) {
    const { frame } = fallPose(ms)
    assert.ok(frame >= from && frame <= to)
    seen.add(frame)
  }
  assert.equal(seen.size, to - from + 1)
})

test('al tocar suelo corre el golpe entero, en orden, y termina de pie', () => {
  const [from, to] = span('land')
  assert.deepEqual(fallPose(FALL_MS), { frame: from, lift: 0, done: false })
  const frames = []
  for (let ms = FALL_MS; ms < FALL_MS + LAND_MS; ms += 10) frames.push(fallPose(ms).frame)
  assert.deepEqual([...new Set(frames)], Array.from({ length: to - from + 1 }, (_, i) => from + i))
  assert.deepEqual(fallPose(FALL_MS + LAND_MS), { frame: to, lift: 0, done: true })
})

test('readArrival solo acepta las dos llegadas', () => {
  assert.equal(readArrival('mundo'), 'mundo')
  assert.equal(readArrival('portada'), 'portada')
  for (const other of [null, undefined, '', 'Mundo', 'cover']) assert.equal(readArrival(other), null)
})

test('el arranque de layout.tsx lee la misma clave y los mismos valores', () => {
  const layout = readFileSync(new URL('src/app/layout.tsx', root), 'utf8')
  assert.ok(layout.includes(`sessionStorage.getItem('${ARRIVAL_KEY}')`))
  assert.ok(layout.includes("a==='mundo'||a==='portada'"))
})

test('la hoja del mundo y la de la 404 son la misma', () => {
  assert.equal(SHEETS.fall.src, LOST.src)
  assert.equal(SHEETS.fall.frames, LOST.frames)
  assert.equal(SHEETS.fall.footY, LOST.footY)
  assert.equal(SHEETS.fall.centerX, LOST.centerX)
})
