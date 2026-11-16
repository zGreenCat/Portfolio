import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

import { EVENTS, eventThumb } from '../src/content/portfolio.ts'

const here = (path) => new URL(`../public${path}`, import.meta.url)

test('cada foto declarada de un evento existe, y lleva texto alternativo', () => {
  for (const event of EVENTS) {
    for (const photo of event.photos ?? []) {
      assert.ok(existsSync(here(photo.src)), `falta ${photo.src}`)
      assert.ok(photo.alt.trim().length > 10, `${photo.src} no describe la foto`)
    }
  }
})

test('todo evento con fotos tiene la miniatura de su portada', () => {
  for (const event of EVENTS) {
    if (!event.photos?.length) continue
    assert.ok(existsSync(here(eventThumb(event.id))), `falta la miniatura de ${event.id}`)
    assert.ok(event.photos[0].src.startsWith(`/events/${event.id}-`), `${event.id}: la portada no es suya`)
  }
})

test('los tres puestos del podio tienen fotos', () => {
  const placed = EVENTS.filter((event) => event.place !== null)
  assert.equal(placed.length, 3)
  for (const event of placed) assert.ok(event.photos?.length, `${event.id} no tiene fotos`)
})
