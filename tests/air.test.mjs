import assert from 'node:assert/strict'
import { test } from 'node:test'

import { airAt, gust } from '../src/world/air.ts'
import { MOUNT_RADIUS, SECTIONS } from '../src/world/constants.ts'
import { nearestSection, sectionsNear } from '../src/world/geometry.ts'

const at = (id) => SECTIONS.findIndex((section) => section.id === id)

test('en su bioma cae su clima a toda fuerza, y donde no hay, nada', () => {
  assert.deepEqual(airAt(at('proyectos'), at('skills'), 0), { kind: 'snow', power: 1 })
  // El bosque no tiene clima: ya se anuncia el del desierto, pero sin fuerza.
  assert.deepEqual(airAt(at('inicio'), at('sobre-mi'), 0), { kind: 'sand', power: 0 })
  assert.deepEqual(airAt(at('contacto'), at('contacto'), 0), { kind: null, power: 0 })
})

test('en la frontera el clima se desvanece y entra el siguiente, sin corte', () => {
  const snow = at('proyectos')
  const petals = at('skills')
  assert.deepEqual(airAt(snow, petals, 0.25), { kind: 'snow', power: 0.5 })
  // A mitad de camino no cae nada: uno ya se apagó y el otro aún no entra.
  assert.equal(airAt(snow, petals, 0.5).power, 0)
  assert.deepEqual(airAt(snow, petals, 0.75), { kind: 'petals', power: 0.5 })
  assert.deepEqual(airAt(snow, petals, 1), { kind: 'petals', power: 1 })
})

test('desde un bioma sin clima, el siguiente va entrando en la segunda mitad', () => {
  const forest = at('inicio')
  const desert = at('sobre-mi')
  assert.deepEqual(airAt(forest, desert, 0.4), { kind: 'sand', power: 0 })
  assert.deepEqual(airAt(forest, desert, 0.75), { kind: 'sand', power: 0.5 })
})

test('hacia un bioma sin clima, el propio se apaga y no entra nada', () => {
  const petals = at('skills')
  const cliff = at('contacto')
  assert.deepEqual(airAt(petals, cliff, 0.8), { kind: 'petals', power: 0 })
})

test('las rachas suben y bajan, pero nunca apagan la tormenta ni la pasan de fuerza', () => {
  let low = Infinity
  let high = -Infinity
  for (let now = 0; now < 600000; now += 97) {
    const power = gust(now)
    low = Math.min(low, power)
    high = Math.max(high, power)
  }
  assert.ok(low >= 0.45 && high <= 1, `de ${low} a ${high}`)
  assert.ok(high - low > 0.4, 'se nota la racha')
})

test('cada sección es la más cercana a sí misma', () => {
  for (const section of SECTIONS) assert.equal(nearestSection(section.at).id, section.id)
  assert.equal(nearestSection(0.1).id, 'inicio')
  assert.equal(nearestSection(0.99).id, 'contacto')
})

test('se montan el bioma que pisas y sus vecinos cercanos, no los cinco', () => {
  for (const section of SECTIONS) {
    const near = sectionsNear(section.at, MOUNT_RADIUS)
    assert.ok(near.includes(SECTIONS.indexOf(section)))
    assert.ok(near.length < SECTIONS.length, `${section.id} monta ${near.length}`)
  }
  assert.deepEqual(sectionsNear(0, MOUNT_RADIUS), [0, 1])
})
