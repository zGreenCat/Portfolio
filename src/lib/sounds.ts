export type SoundName = 'button' | 'throw' | 'teleport'

const SOURCES: Record<SoundName, string> = {
  button: '/sounds/button.mp3',
  throw: '/sounds/throw.mp3',
  teleport: '/sounds/teleport.mp3',
}

/** Volumen por sonido: el del botón se repite mucho y molesta si va igual de alto. */
const VOLUME: Record<SoundName, number> = {
  button: 0.35,
  throw: 0.5,
  teleport: 0.55,
}

const STORAGE_KEY = 'portfolio:muted'

let muted = false
let loaded = false
const pool = new Map<SoundName, HTMLAudioElement[]>()

/** Dos copias por sonido: si suena otra vez antes de acabar, hay una libre. */
const COPIES = 2

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  muted = window.localStorage.getItem(STORAGE_KEY) === '1'

  ;(Object.keys(SOURCES) as SoundName[]).forEach((name) => {
    pool.set(
      name,
      Array.from({ length: COPIES }, () => {
        const audio = new Audio(SOURCES[name])
        audio.preload = 'auto'
        audio.volume = VOLUME[name]
        return audio
      }),
    )
  })
}

export function isMuted(): boolean {
  ensureLoaded()
  return muted
}

export function setMuted(next: boolean): void {
  ensureLoaded()
  muted = next
  window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
}

/**
 * Reproduce un efecto. Silencioso si falla: los navegadores bloquean el audio
 * hasta que hay interacción del usuario, y un sonido que no suena nunca debe
 * romper la acción que lo disparó.
 */
export function play(name: SoundName): void {
  ensureLoaded()
  if (muted) return

  const copies = pool.get(name)
  if (!copies) return

  const free = copies.find((a) => a.paused || a.ended) ?? copies[0]
  free.currentTime = 0
  void free.play().catch(() => {})
}
