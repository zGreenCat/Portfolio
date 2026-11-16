import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CHAT_CHANCE, pickTeleport, slug, tpCommand, tpReply } from '../src/components/teleport.ts'

test('sentado o en el podio, siempre el comando', () => {
  for (const roll of [0, 0.5, 0.999]) assert.equal(pickTeleport({ settled: true, roll }), 'chat')
})

test('de pie, la perla casi siempre y el comando una de cada tres', () => {
  assert.equal(pickTeleport({ settled: false, roll: 0 }), 'chat')
  assert.equal(pickTeleport({ settled: false, roll: CHAT_CHANCE - 0.001 }), 'chat')
  assert.equal(pickTeleport({ settled: false, roll: CHAT_CHANCE }), 'pearl')
  assert.equal(pickTeleport({ settled: false, roll: 0.999 }), 'pearl')
})

test('forzado por URL, manda sobre todo lo demás', () => {
  assert.equal(pickTeleport({ settled: true, roll: 0, force: 'pearl' }), 'pearl')
  assert.equal(pickTeleport({ settled: false, roll: 0.999, force: 'chat' }), 'chat')
})

test('el destino se escribe como en un comando: sin tildes, mayúsculas ni espacios', () => {
  assert.equal(slug('Sobre mí'), 'sobre-mi')
  assert.equal(slug('Experiencias'), 'experiencias')
  assert.equal(slug('  CV en PDF '), 'cv-en-pdf')
  assert.equal(tpCommand('Sobre mí'), '/tp sobre-mi')
})

test('la respuesta nombra el sitio como se lee en la barra', () => {
  assert.equal(tpReply('Sobre mí'), 'Vicente fue teletransportado a Sobre mí')
})
