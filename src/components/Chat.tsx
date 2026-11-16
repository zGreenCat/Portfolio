'use client'

import { useEffect, useState } from 'react'

import styles from './Chat.module.css'

export interface ChatRequest {
  /** Cambia en cada petición: la misma orden dos veces tiene que volver a escribirse. */
  key: number
  command: string
  reply: string
}

interface ChatProps {
  request: ChatRequest | null
  /** El comando ya está escrito y se pulsa Enter: el momento de ejecutarlo. */
  onSend: () => void
  /** La respuesta ya se desvaneció. */
  onDone: () => void
}

const OPEN_MS = 260
const KEY_MS = 62
const ENTER_MS = 300
const REPLY_MS = 2800
const FADE_MS = 500

/**
 * El chat del juego, abajo a la izquierda.
 *
 * Hoy se escribe solo: enseña el comando tecla a tecla, lo envía y deja la
 * respuesta unos segundos. Está partido en barra de entrada y registro para
 * que el día que escriba el visitante solo haya que cambiar la barra por un
 * campo de texto; lo demás —el registro, los tiempos de la respuesta— vale.
 */
export default function Chat({ request, onSend, onDone }: ChatProps) {
  const [typed, setTyped] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'reply' | 'fading'>('typing')

  useEffect(() => {
    if (!request) return
    setTyped(0)
    setPhase('typing')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = request.command.length
    const timers: number[] = []
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms))

    const written = still ? OPEN_MS : OPEN_MS + total * KEY_MS
    if (still) at(0, () => setTyped(total))
    else for (let i = 1; i <= total; i += 1) at(OPEN_MS + i * KEY_MS, () => setTyped(i))
    at(written + ENTER_MS, () => {
      setPhase('reply')
      onSend()
    })
    at(written + ENTER_MS + REPLY_MS, () => setPhase('fading'))
    at(written + ENTER_MS + REPLY_MS + FADE_MS, onDone)
    return () => timers.forEach((timer) => window.clearTimeout(timer))
    // Los avisos no entran: cambian de identidad en cada render de la página
    // y reiniciarían la escritura a media orden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.key])

  if (!request) return null

  return (
    <div className={styles.chat}>
      {/* Quien usa lector de pantalla recibe la respuesta, que es lo que
          pasó; el comando tecla a tecla sería ruido. */}
      <p
        className={`${styles.line} ${phase === 'typing' ? styles.waiting : ''} ${phase === 'fading' ? styles.fading : ''}`}
        role="status"
      >
        {phase === 'typing' ? '' : request.reply}
      </p>
      {phase === 'typing' ? (
        <p className={styles.input} aria-hidden="true">
          {request.command.slice(0, typed)}
          <span className={styles.caret}>_</span>
        </p>
      ) : null}
    </div>
  )
}
