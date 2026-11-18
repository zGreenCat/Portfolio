import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DUSK_FROM, NIGHT_AT, SECTIONS } from '../src/world/constants.ts'
import { DAWN, MOONSET, moonAt, nightAt, storeTheme, storedTheme, sunAt } from '../src/world/daylight.ts'

test('en claro es de día casi todo el recorrido y anochece hacia el acantilado', () => {
  assert.equal(nightAt(0, 'light'), 0)
  assert.equal(nightAt(DUSK_FROM, 'light'), 0)
  assert.equal(nightAt(NIGHT_AT, 'light'), 1)
  assert.equal(nightAt(1, 'light'), 1)
})

test('en oscuro es de noche casi todo el recorrido y amanece hacia el acantilado', () => {
  assert.equal(nightAt(0, 'dark'), 1)
  assert.equal(nightAt(DUSK_FROM, 'dark'), 1)
  assert.ok(Math.abs(nightAt(NIGHT_AT, 'dark') - DAWN) < 1e-9)
  assert.ok(Math.abs(nightAt(1, 'dark') - DAWN) < 1e-9)
})

test('la hora cambia de forma continua y sin salirse de 0…1, en los dos temas', () => {
  for (const theme of ['light', 'dark']) {
    let before = nightAt(0, theme)
    for (let at = 0; at <= 1.0001; at += 0.005) {
      const now = nightAt(at, theme)
      assert.ok(now >= 0 && now <= 1)
      assert.ok(Math.abs(now - before) < 0.02, `${theme}: salto en ${at}`)
      before = now
    }
  }
})

test('los cuatro primeros biomas se recorren con una sola luz en cada tema', () => {
  for (const section of SECTIONS.slice(0, 3)) {
    assert.equal(nightAt(section.at, 'light'), 0, section.id)
    assert.equal(nightAt(section.at, 'dark'), 1, section.id)
  }
})

test('el sol solo sale en oscuro, y sale entero al amanecer', () => {
  assert.equal(sunAt(1, 'dark'), 0, 'de noche cerrada no hay sol')
  assert.ok(Math.abs(sunAt(DAWN, 'dark') - 1) < 1e-9)
  assert.ok(sunAt(0.6, 'dark') > 0 && sunAt(0.6, 'dark') < 1)
  for (const night of [0, 0.4, 1]) assert.equal(sunAt(night, 'light'), 0)
})

test('sin nada guardado, o con el almacenamiento roto, el tema es claro', () => {
  assert.equal(storedTheme(() => null), 'light')
  assert.equal(storedTheme(() => 'dark'), 'dark')
  assert.equal(storedTheme(() => 'otra-cosa'), 'light')
  assert.equal(
    storedTheme(() => {
      throw new Error('bloqueado')
    }),
    'light',
  )
})

test('guardar el tema no revienta si el almacenamiento falla', () => {
  const saved = {}
  storeTheme('dark', (key, value) => {
    saved[key] = value
  })
  assert.deepEqual(saved, { tema: 'dark' })
  storeTheme('dark', () => {
    throw new Error('lleno')
  })
})

test('en oscuro la luna cruza el cielo y se pone antes de que salga el sol', () => {
  const start = moonAt(0, 'dark')
  assert.ok(start.x < -0.5, 'sale a la izquierda')
  assert.equal(start.y, 0, 'y alta')
  const set = moonAt(MOONSET, 'dark')
  assert.ok(Math.abs(set.x) < 1e-9, 'se pone en su sitio de siempre')
  assert.ok(set.y > 0.5, 'ya bajo los cerros')
  assert.deepEqual(moonAt(1, 'dark'), set, 'y ahí se queda')
  // Puesta la luna, el sol aún no ha salido del todo: no se cruzan arriba.
  assert.ok(sunAt(nightAt(MOONSET, 'dark'), 'dark') < 0.5)
})

test('la luna solo baja y solo va hacia la derecha: no vuelve sobre sus pasos', () => {
  let before = moonAt(0, 'dark')
  for (let at = 0.01; at <= 1; at += 0.01) {
    const now = moonAt(at, 'dark')
    assert.ok(now.x >= before.x - 1e-9 && now.y >= before.y - 1e-9, `en ${at}`)
    before = now
  }
})

test('en claro la luna no se mueve de su sitio', () => {
  for (const at of [0, 0.5, 1]) assert.deepEqual(moonAt(at, 'light'), { x: 0, y: 0 })
})
