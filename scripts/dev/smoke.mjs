// Recorre el mundo por puntos fijos y anota dónde está cada cosa. Para
// comprobar que un cambio que solo mueve código no cambió nada.
//
//   node scripts/dev/smoke.mjs <salida.json>              guarda las medidas
//   node scripts/dev/smoke.mjs <salida.json> <referencia> y las compara
//
// Mide posiciones y estados ya asentados, redondeados al píxel: capas,
// personaje, hoja activa, cajones, sentarse, podio y perla. No mide lo que
// corre por tiempo (el reposo, el clima). Necesita el servidor de desarrollo.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [out, reference] = process.argv.slice(2)
if (!out) throw new Error('Uso: smoke.mjs <salida.json> [referencia.json]')

const browse = join(dirname(fileURLToPath(import.meta.url)), 'browse.mjs')

// Con ancla no hay portada, y `tp=0` deja la perla como única forma de irse:
// al azar, dos pasadas no serían comparables.
const SITE = 'http://localhost:3000/?tp=0&lite=0#smoke'

const PAGE = `
const r = (n) => Math.round(n)
const rect = (el) => {
  if (!el) return null
  const b = el.getBoundingClientRect()
  return [r(b.left), r(b.top), r(b.width), r(b.height)].join(',')
}
const stage = document.querySelector('[class*="stage"]')
const snap = () => ({
  y: r(scrollY),
  hash: location.hash.replace(/&c=\\d+$/, ''),
  sheet: document.querySelector('[data-state]')?.dataset.state ?? null,
  actor: rect(document.querySelector('[class*="actor"]')),
  strips: [...stage.querySelectorAll('[class*="strip"]')].map((el) => rect(el)).sort(),
  tiles: [...stage.querySelectorAll('img')]
    .map((el) => (el.getAttribute('src') ?? '').split('/').pop() + '@' + rect(el))
    .sort(),
  drawers: [...document.querySelectorAll('[class*="drawer"]')].map((el) => rect(el)),
  chest: rect(document.querySelector('[class*="chest"]')),
  nav: [...document.querySelectorAll('nav button[aria-current]')].map((el) => el.textContent.trim()),
})
const steps = {}
await w(6000)
steps.start = snap()
for (const y of [700, 1400, 2100, 2800, 3220, 3500, 4200, 4900, 5600, 6300]) {
  window.scrollTo(0, y)
  await w(2600)
  steps['y' + y] = snap()
}
window.scrollTo(0, 99999)
await w(5000)
steps.sat = snap()
window.scrollTo(0, 5600)
// Al levantarse la recuperación va acotada: tarda más en asentarse.
await w(8000)
steps.stoodUp = snap()
const press = (label) =>
  [...document.querySelectorAll('nav button')].find((b) => b.textContent.trim() === label)?.click()
press('Experiencias')
await w(4000)
steps.pearlToChest = snap()
document.querySelector('[class*="podiumHit"]')?.click()
await w(6500)
steps.onPodium = snap()
press('Inicio')
await w(4500)
steps.backHome = snap()
return JSON.stringify(steps)
`

// El mundo se acerca a su sitio suavizando y no llega a clavarse: entre dos
// pasadas iguales las x bailan unos píxeles (sentado, hasta cinco: el mundo se congela en el frame en que llega). Se comparan los números con
// ese margen y el resto, letra a letra.
const SLACK_PX = 12
const NUMBER = /-?\d+/g
const same = (a, b) => {
  const [x, y] = [JSON.stringify(a) ?? '', JSON.stringify(b) ?? '']
  if (x.replace(NUMBER, '#') !== y.replace(NUMBER, '#')) return false
  const [p, q] = [x.match(NUMBER) ?? [], y.match(NUMBER) ?? []]
  return p.every((value, i) => Math.abs(Number(value) - Number(q[i])) <= SLACK_PX)
}

const run = (size, dpr, mobile) =>
  JSON.parse(
    execFileSync('node', [browse, size, dpr, mobile, PAGE], {
      env: { ...process.env, URL: SITE },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .trim()
      .split('\n')
      .pop(),
  )

const result = {
  desktop: run('1280x800', '1', '0'),
  laptop125: run('982x727', '1.25', '0'),
  phone: run('400x820', '2', '1'),
}
writeFileSync(out, JSON.stringify(result, null, 1))

if (!reference) {
  console.log(`smoke: medidas guardadas en ${out}`)
} else {
  const before = JSON.parse(readFileSync(reference, 'utf8'))
  const changes = []
  for (const [screen, steps] of Object.entries(result)) {
    for (const [step, now] of Object.entries(steps)) {
      for (const [key, value] of Object.entries(now)) {
        const was = before[screen]?.[step]?.[key]
        if (!same(was, value)) {
          changes.push(`${screen} · ${step} · ${key}\n   antes: ${JSON.stringify(was)?.slice(0, 220)}\n   ahora: ${JSON.stringify(value)?.slice(0, 220)}`)
        }
      }
    }
  }
  if (changes.length === 0) console.log('smoke: sin cambios')
  else {
    console.log(`smoke: ${changes.length} diferencias\n${changes.join('\n')}`)
    process.exitCode = 1
  }
}
