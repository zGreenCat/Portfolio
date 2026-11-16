// Abre el sitio en Chromium sin ventana, ejecuta un script en la página y
// opcionalmente guarda una captura. Para probar maquetación cuando no hay
// navegador a mano, y sobre todo a densidades que no son 1×.
//
//   node scripts/dev/browse.mjs <ancho>x<alto> <dpr> <movil 0|1> '<js>' [captura.png]
//
// El `<js>` es el cuerpo de una función async; dentro hay `w(ms)` para esperar
// y lo que devuelva se imprime. `URL=…` cambia el sitio (por defecto, el
// servidor de desarrollo). Chromium renderiza aquí por software: sirve para
// posiciones y tamaños, no para medir rendimiento.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [size, dpr = '1', mobile = '0', js = 'return document.title', shot] = process.argv.slice(2)
if (!size) throw new Error('Uso: browse.mjs <ancho>x<alto> <dpr> <movil 0|1> <js> [captura.png]')
const [width, height] = size.split('x').map(Number)
const port = 9600 + Math.floor(Math.random() * 300)
const profile = mkdtempSync(join(process.env.XDG_RUNTIME_DIR ?? '/tmp', 'browse-'))
const chrome = spawn(
  '/usr/bin/chromium',
  ['--headless=new', `--remote-debugging-port=${port}`, `--window-size=${width},${height}`, `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let socket
try {
  let tabs
  for (let i = 0; i < 40 && !tabs; i += 1) {
    tabs = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json()).catch(() => null)
    if (!tabs) await sleep(250)
  }
  if (!tabs) throw new Error('Chromium no arrancó')
  socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve) => (socket.onopen = resolve))
  let id = 0
  const pending = new Map()
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data)
    if (data.id) {
      pending.get(data.id)?.(data.result ?? data)
      pending.delete(data.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      id += 1
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: Number(dpr), mobile: mobile === '1' })
  if (mobile === '1') await send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const base = process.env.URL ?? 'http://localhost:3000/'
  await send('Page.navigate', { url: `${base}${base.includes('?') ? '&' : '?'}c=${Date.now()}` })
  await sleep(14000)
  const result = await send('Runtime.evaluate', {
    expression: `(async () => { const w = (ms) => new Promise((r) => setTimeout(r, ms)); ${js} })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log(result.result?.value ?? JSON.stringify(result.exceptionDetails?.exception?.description ?? result))
  if (shot) {
    const image = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(shot, Buffer.from(image.data, 'base64'))
  }
} finally {
  socket?.close()
  chrome.kill()
  await sleep(300)
  rmSync(profile, { recursive: true, force: true })
}
