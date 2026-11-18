import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  OTHER_EVENTS,
  PODIUM_WORKS,
  PROJECT_WORKS,
  WORKS,
  byYear,
  fitFrame,
  plainName,
  position,
  sibling,
  splitSummary,
} from '../src/components/works.ts'
import { EVENTS, EXPERIENCE, PROJECTS, SITE_PROJECT } from '../src/content/portfolio.ts'

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

test('el resumen se parte en qué es y para quién', () => {
  assert.deepEqual(splitSummary('Gestión académica con IA · UCN'), {
    what: 'Gestión académica con IA',
    who: 'UCN',
  })
  assert.deepEqual(splitSummary('Landing corporativa'), { what: 'Landing corporativa', who: '' })
})

test('el nombre pierde la coletilla del resultado, y solo eso', () => {
  assert.equal(plainName('HackaDisc — 1.er lugar'), 'HackaDisc')
  assert.equal(plainName('NASA Space Apps Challenge'), 'NASA Space Apps Challenge')
})

test('hay una ficha por proyecto, en su orden, y ninguna dice su puesto en el título', () => {
  // Los de siempre y, el último, este sitio, que solo sale en la portada.
  assert.deepEqual(
    PROJECT_WORKS.map((work) => work.id),
    [...PROJECTS.map((project) => `project:${project.id}`), `project:${SITE_PROJECT.id}`],
  )
  for (const work of PROJECT_WORKS) assert.ok(!/lugar/i.test(work.title), work.title)
})

test('el podio va 2.º, 1.º, 3.º, y solo suben los que tienen puesto', () => {
  assert.deepEqual(PODIUM_WORKS.map((work) => work.place), [2, 1, 3])
  assert.equal(PODIUM_WORKS.length, EVENTS.filter((event) => event.place !== null).length)
})

test('proyectos y hackatones son dos listas: ninguna ficha está en las dos', () => {
  const projects = new Set(PROJECT_WORKS.map((work) => work.id))
  for (const work of PODIUM_WORKS) assert.ok(!projects.has(work.id))
  assert.equal(PROJECT_WORKS.length + PODIUM_WORKS.length, WORKS.length)
})

test('donde un proyecto salió de un podio, las dos fichas se enlazan entre sí', () => {
  const linked = WORKS.filter((work) => work.jump)
  assert.ok(linked.length >= 2, 'hay al menos una pareja')
  for (const work of linked) {
    const other = WORKS.find((candidate) => candidate.id === work.jump.to)
    assert.ok(other, `${work.id} enlaza con una ficha que no existe`)
    assert.notEqual(other.group, work.group, 'el enlace cruza de sección')
    assert.equal(other.jump?.to, work.id, 'y vuelve')
    assert.equal(other.place, work.place, 'las dos llevan el mismo puesto')
  }
})

test('un proyecto hecho en un hackatón sin podio lo dice, pero no enlaza a una ficha que no hay', () => {
  for (const other of OTHER_EVENTS) {
    if (!other.projectWork) continue
    const work = WORKS.find((candidate) => candidate.id === other.projectWork)
    assert.ok(work, `${other.label} apunta a un proyecto que no existe`)
    assert.equal(work.event, other.label)
    assert.equal(work.place, null)
    assert.equal(work.jump, undefined)
  }
})

test('las flechas no salen de su sección, y dan la vuelta', () => {
  for (const work of WORKS) {
    for (const delta of [1, -1]) {
      const next = WORKS.find((candidate) => candidate.id === sibling(WORKS, work.id, delta))
      assert.equal(next.group, work.group)
    }
  }
  const first = PROJECT_WORKS[0].id
  const last = PROJECT_WORKS[PROJECT_WORKS.length - 1].id
  assert.equal(sibling(WORKS, last, 1), first)
  assert.equal(sibling(WORKS, first, -1), last)
})

test('el contador cuenta dentro de la sección', () => {
  assert.deepEqual(position(WORKS, PROJECT_WORKS[2].id), { index: 3, total: PROJECT_WORKS.length })
  assert.equal(position(WORKS, PODIUM_WORKS[0].id).total, PODIUM_WORKS.length)
})

test('pedir una ficha que no existe es un error, no un salto a la primera', () => {
  assert.throws(() => sibling(WORKS, 'project:no-existe', 1))
  assert.throws(() => position(WORKS, 'event:no-existe'))
})

test('cada imagen de cada ficha existe y tiene la forma que declara', () => {
  for (const work of WORKS) {
    assert.ok(work.shots.length > 0, `${work.id} no tiene imagen`)
    for (const shot of work.shots) {
      assert.ok(existsSync(new URL(`public${shot.src}`, root)), shot.src)
      const [width, height] = webpSize(shot.src)
      assert.ok(Math.abs(width / height - shot.ratio) < 0.02, `${shot.src} mide ${width}×${height}`)
    }
  }
})

test('el marco llena la caja por el lado que manda y conserva la forma', () => {
  assert.deepEqual(fitFrame(2, 1000, 400), { width: 800, height: 400 })
  assert.deepEqual(fitFrame(2, 600, 400), { width: 600, height: 300 })
  const frame = fitFrame(16 / 9, 739, 416)
  assert.ok(Math.abs(frame.width / frame.height - 16 / 9) < 1e-9)
  assert.ok(frame.width <= 739 && frame.height <= 416 + 1e-9)
})

test('sin sitio no hay marco, en vez de uno negativo', () => {
  assert.deepEqual(fitFrame(1.5, 0, 300), { width: 0, height: 0 })
  assert.deepEqual(fitFrame(1.5, 300, -20), { width: 0, height: 0 })
})

test('este sitio va como un proyecto más, con su código y sin demo', () => {
  const self = PROJECT_WORKS[PROJECT_WORKS.length - 1]
  assert.equal(self.title, SITE_PROJECT.name)
  assert.equal(self.repo, SITE_PROJECT.repo)
  assert.equal(self.url, undefined)
  assert.equal(PROJECTS.some((project) => project.id === SITE_PROJECT.id), false, 'no entra al cofre del mundo')
})

test('la trayectoria va del año más reciente al más antiguo, un grupo por año', () => {
  const groups = byYear(EXPERIENCE)
  const years = groups.map((group) => group.year)
  assert.deepEqual(years, [...years].sort((a, b) => b - a))
  assert.equal(new Set(years).size, years.length, 'ningún año sale dos veces')
  assert.equal(groups.reduce((count, group) => count + group.jobs.length, 0), EXPERIENCE.length)
})

test('cada cargo tiene lo que la línea de tiempo enseña, y «hoy» solo si sigue', () => {
  for (const job of EXPERIENCE) {
    for (const field of ['role', 'place', 'when', 'text']) assert.ok(job[field].length > 0, `${job.id}: ${field}`)
    assert.equal(job.when.endsWith('hoy'), job.current, job.id)
  }
  assert.ok(EXPERIENCE.some((job) => job.current))
})
