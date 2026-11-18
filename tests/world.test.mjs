import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FRAME_COUNT } from '../src/components/characterSheets.ts'
import {
  PANEL_CLOSE_AT,
  PANEL_OPEN_AT,
  SCROLL_LENGTH,
  SECTIONS,
  WORLD_LENGTH,
  atOf,
  scrollFromWorld,
  worldFromScroll,
} from '../src/world/constants.ts'
import {
  BOUNDS,
  biomeAt,
  clearingPhase,
  fitBounds,
  landingAt,
  makeBounds,
  panelOpenness,
  quantize,
} from '../src/world/geometry.ts'
import { PODIUM_WAY_DOWN, PODIUM_WAY_UP, STAGE, hopSpot, podiumPose } from '../src/world/podium.ts'

test('scroll y mundo son la misma medida, ida y vuelta, y no se salen', () => {
  assert.equal(worldFromScroll(scrollFromWorld(0.37)), 0.37)
  assert.equal(worldFromScroll(-50), 0)
  assert.equal(worldFromScroll(SCROLL_LENGTH * 3), 1)
})

test('las secciones se buscan por id y van en orden de recorrido', () => {
  assert.equal(atOf('inicio'), 0)
  assert.equal(atOf('proyectos'), 0.52)
  const places = SECTIONS.map((section) => section.at)
  assert.deepEqual(places, [...places].sort((a, b) => a - b))
})

for (const [name, viewport, tile] of [
  ['escritorio', 1920, 3097],
  ['portátil al 125%', 982, 2085],
  ['móvil', 400, 1082],
]) {
  test(`${name}: los territorios cubren el mundo sin huecos ni solapes`, () => {
    const bounds = makeBounds(viewport, tile)
    assert.equal(bounds.length, SECTIONS.length)
    assert.equal(bounds[0].from, -Infinity)
    assert.equal(bounds[bounds.length - 1].to, Infinity)
    for (let i = 1; i < bounds.length; i += 1) {
      assert.equal(bounds[i].from, bounds[i - 1].to, `frontera ${i}`)
      assert.ok(bounds[i].from > SECTIONS[i - 1].at, `la frontera ${i} cae pasada su sección`)
      assert.ok(bounds[i].from < SECTIONS[i].at, `la frontera ${i} cae antes de la siguiente`)
    }
  })

}

// Los claros están donde se juntan dos copias del suelo del acantilado por el
// extremo sin árbol: a un número impar de suelos del ancla.
const copiesToCliff = (viewport, tile) => {
  const bounds = makeBounds(viewport, tile)
  const ground = (2371 / 3840) * tile
  const anchor = WORLD_LENGTH + viewport * 0.48 - ground
  return (anchor - bounds[bounds.length - 1].from * WORLD_LENGTH) / ground
}

for (const [name, viewport, tile] of [
  ['portátil al 125%', 982, 2085],
  ['móvil', 400, 1082],
]) {
  test(`${name}: la frontera con el acantilado cae en un claro de su suelo`, () => {
    const copies = copiesToCliff(viewport, tile)
    assert.ok(Math.abs(copies - Math.round(copies)) < 1e-6, `queda a ${copies} suelos`)
    assert.equal(Math.round(copies) % 2, 1)
  })
}

test('escritorio: sin claro entre las dos secciones, la frontera se queda a medio camino', () => {
  // Con teselas de 3.097 px ningún claro cae entre Skills y Contacto, así que
  // ahí el recorte sigue donde estaba y puede partir un árbol.
  const bounds = makeBounds(1920, 3097)
  const last = bounds.length - 1
  assert.equal(bounds[last].from, (SECTIONS[last - 1].at + SECTIONS[last].at) / 2)
})

test('el primer bioma llega al menos hasta donde alcanza la pantalla al entrar', () => {
  const bounds = makeBounds(3840, 6000)
  assert.ok(bounds[0].to >= (3840 * 1.12) / WORLD_LENGTH)
})

test('biomeAt dice en qué bioma estás y cuánto asoma el siguiente', () => {
  fitBounds(1920, 3097)
  SECTIONS.forEach((section, i) => {
    assert.equal(biomeAt(section.at).index, i, section.id)
    assert.equal(biomeAt(section.at).blend, 0, `${section.id}: en su sitio no hay mezcla`)
  })
  const edge = BOUNDS[1].to
  assert.equal(biomeAt(edge - 1e-9).index, 1)
  assert.ok(biomeAt(edge - 1e-9).blend > 0.99)
  assert.equal(biomeAt(edge).index, 2)
  assert.equal(biomeAt(1).blend, 0, 'el último no se mezcla con nadie')
})

test('un panel se abre del todo cerca y se cierra más lejos de lo que abre', () => {
  assert.equal(panelOpenness(0.5, 0.5), 1)
  assert.ok(Math.abs(panelOpenness(0.5, 0.5 + PANEL_OPEN_AT) - 1) < 1e-9)
  assert.ok(Math.abs(panelOpenness(0.5, 0.5 + PANEL_CLOSE_AT)) < 1e-9)
  assert.equal(panelOpenness(0.5, 0.9), 0)
  const half = panelOpenness(0.5, 0.5 - (PANEL_OPEN_AT + PANEL_CLOSE_AT) / 2)
  assert.ok(Math.abs(half - 0.5) < 1e-9)
})

test('quantize deja el valor en escalones', () => {
  assert.equal(quantize(0.49, 20), 0.5)
  assert.equal(quantize(0.52, 20), 0.5)
  assert.equal(quantize(1, 24), 1)
})

test('el corrimiento del suelo deja la frontera en una unión impar', () => {
  for (const [frontier, tile] of [[8000, 3097], [7421.5, 1082], [100, 2085]]) {
    const phase = clearingPhase(frontier, tile)
    assert.ok(phase >= 0 && phase < 2 * tile)
    const joins = (frontier - phase) / tile
    assert.ok(Math.abs(joins - Math.round(joins)) < 1e-6)
    assert.equal(Math.abs(Math.round(joins)) % 2, 1)
  }
})

test('subiendo al podio: sale del estrado, pasa por el 2.º y acaba en el 1.º', () => {
  assert.deepEqual(hopSpot(0, PODIUM_WAY_UP), { x: 0, up: STAGE.lift })
  assert.deepEqual(hopSpot(11, PODIUM_WAY_UP), STAGE.second)
  assert.deepEqual(hopSpot(999, PODIUM_WAY_UP), STAGE.first)
  // A medio salto va por encima de la línea entre los dos apoyos: es un
  // arco, no una rampa.
  const mid = hopSpot(7, PODIUM_WAY_UP)
  assert.ok(mid.up > (STAGE.lift + STAGE.second.up) / 2)
  assert.ok(mid.x > 0 && mid.x < STAGE.second.x)
})

test('la pose del podio empieza abajo y termina arriba, sin pasarse de la hoja', () => {
  assert.equal(podiumPose(0, false).frame, 0)
  assert.deepEqual(podiumPose(0, false).spot, { x: 0, up: STAGE.lift })
  assert.equal(podiumPose(1, false).frame, FRAME_COUNT.climb - 1)
  assert.deepEqual(podiumPose(1, false).spot, STAGE.first)
})

test('bajando hacia delante: se gira en el 1.º y sale por el 3.º a la alfombra', () => {
  assert.deepEqual(podiumPose(1, true).spot, STAGE.first)
  assert.equal(podiumPose(1, true).frame, FRAME_COUNT.climb - 1)
  assert.deepEqual(podiumPose(0, true).spot, STAGE.exit)
  assert.deepEqual(hopSpot(11, PODIUM_WAY_DOWN), STAGE.third)
  for (let at = 0; at <= 1; at += 0.01) {
    const { frame } = podiumPose(at, true)
    assert.ok(frame >= 0 && frame < FRAME_COUNT.climb)
  }
})

test('se aterriza antes de la sección, con su frontera fuera de cuadro', () => {
  fitBounds(1920, 3097)
  const skills = SECTIONS.findIndex((section) => section.id === 'skills')
  const at = landingAt(skills, 0.4, 1920)
  assert.ok(at <= SECTIONS[skills].at, 'nunca pasada la sección')
  assert.ok(at >= SECTIONS[skills].at - PANEL_OPEN_AT, 'ni tan atrás que el cajón llegue entreabierto')
  // La frontera siguiente queda a más de una pantalla, o el retroceso tocó su tope.
  const edge = BOUNDS[skills].to
  assert.ok(
    (edge - at) * WORLD_LENGTH >= 1920 - 1e-6 ||
      Math.abs(at - (SECTIONS[skills].at - PANEL_OPEN_AT)) < 1e-9,
  )
})

test('a Experiencias se llega junto al cofre, y al final del mundo, a su sitio', () => {
  fitBounds(1920, 3097)
  const chest = SECTIONS.findIndex((section) => section.id === 'proyectos')
  assert.equal(landingAt(chest, 0.4321, 1920), 0.4321)
  const last = SECTIONS.length - 1
  assert.equal(landingAt(last, 0.4, 1920), SECTIONS[last].at)
})

test('en una pantalla estrecha no hace falta retroceder: se cae en la sección', () => {
  fitBounds(400, 1082)
  const about = SECTIONS.findIndex((section) => section.id === 'sobre-mi')
  assert.equal(landingAt(about, 0.4, 400), SECTIONS[about].at)
})
