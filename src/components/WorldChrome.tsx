'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import styles from '@/app/recorrido.module.css'
import { isMuted, play, setMuted } from '@/lib/sounds'
import { BAR_CELLS, SECTIONS } from '@/world/constants'
import type { Theme } from '@/world/daylight'

import { CELL_WIDTH, SHEET_GEOMETRY } from './Character'
import { CELL_HEIGHT, WALKING_STATES, sheetSrc } from './characterSheets'

type Section = (typeof SECTIONS)[number]

interface WorldNavProps {
  /** Fuera hasta que el mundo está listo y sin portada encima. */
  shown: boolean
  menuOpen: boolean
  setMenuOpen: Dispatch<SetStateAction<boolean>>
  /** En estrecho las secciones van plegadas tras «Menú». */
  compact: boolean
  /** Con movimiento reducido, el botón de la portada destaca menos. */
  quiet: boolean
  active: string
  onNavigate: (section: Section) => void
  onCover: () => void
  theme: Theme
  onTheme: () => void
}

/** La barra del mundo: secciones, sonido y la vuelta a la portada. */
export function WorldNav({
  shown,
  menuOpen,
  setMenuOpen,
  compact,
  quiet,
  active,
  onNavigate,
  onCover,
  theme,
  onTheme,
}: WorldNavProps) {
  const [muted, setMutedState] = useState(false)
  useEffect(() => setMutedState(isMuted()), [])

  return (
    <nav
      className={`${styles.nav} ${shown ? styles.navIn : ''}`}
      aria-label="Secciones"
      // Va antes que la portada en el HTML: sin esto un buscador podía armar
      // el fragmento del resultado con los botones de la barra.
      data-nosnippet=""
    >
      <button
        type="button"
        className={`${styles.navButton} ${styles.navToggle}`}
        onClick={() => {
          play('button')
          setMenuOpen((open) => !open)
        }}
        aria-expanded={menuOpen}
        aria-controls="nav-items"
      >
        {menuOpen ? '✕ Cerrar' : '☰ Menú'}
      </button>

      <div id="nav-items" className={styles.navItems} hidden={compact && !menuOpen}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`${styles.navButton} ${active === section.id ? styles.navActive : ''}`}
            onClick={() => onNavigate(section)}
            aria-current={active === section.id ? 'true' : undefined}
          >
            {section.label}
          </button>
        ))}
        <button
          type="button"
          className={styles.navButton}
          onClick={() => {
            const next = !muted
            setMuted(next)
            setMutedState(next)
            if (!next) play('button')
          }}
          aria-pressed={muted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? '🔇 Sonido' : '🔊 Sonido'}
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => {
            play('button')
            onTheme()
          }}
          aria-pressed={theme === 'dark'}
          aria-label={theme === 'dark' ? 'Pasar a tema claro' : 'Pasar a tema oscuro'}
        >
          {theme === 'dark' ? '☀ Día' : '☾ Noche'}
        </button>
        <button
          type="button"
          className={`${styles.navButton} ${quiet ? styles.navQuiet : ''}`}
          onClick={onCover}
        >
          Portada
        </button>
      </div>
    </nav>
  )
}

/** La pantalla de carga, con su barra de celdas. */
export function WorldLoader({ done, progress }: { done: boolean; progress: number }) {
  const filled = Math.round(progress * BAR_CELLS)
  return (
    <div
      className={`${styles.loader} ${done ? styles.loaderDone : ''}`}
      data-nosnippet=""
    >
      <span className={styles.loaderTitle}>Cargando mundo</span>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="Cargando mundo"
      >
        {Array.from({ length: BAR_CELLS }, (_, index) => (
          <span key={index} className={`${styles.cell} ${index < filled ? styles.cellOn : ''}`} />
        ))}
      </div>
      <span className={styles.loaderHint}>Generando terreno</span>
    </div>
  )
}

/**
 * Todas las hojas del personaje, pintadas ya: un píxel de cada una, a
 * la escala a la que se van a usar. Una hoja se decodifica la primera
 * vez que se pinta, y eso era un tirón justo al echar a andar, al
 * lanzar o al subir al podio. `decode()` no vale para fondos CSS.
 */
export function SheetWarmer({ charHeight, half }: { charHeight: number; half: boolean }) {
  return (
    <div className={styles.warm} aria-hidden="true">
      {WALKING_STATES.map((state) => {
        const sheet = SHEET_GEOMETRY[state]
        const scale = charHeight / sheet.charHeight
        return (
          <span
            key={state}
            style={{
              backgroundImage: `url(${sheetSrc(state, half)})`,
              backgroundSize: `${CELL_WIDTH * scale * sheet.frames}px ${CELL_HEIGHT * scale}px`,
            }}
          />
        )
      })}
    </div>
  )
}
