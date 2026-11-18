/**
 * Las fichas de la portada: cada proyecto y cada podio, con lo que enseña su
 * visor. Sin React ni navegador, para poder probarlo.
 *
 * Proyectos y hackatones son dos listas aparte —un hackatón es un logro, un
 * proyecto es un trabajo— y solo se tocan donde coinciden: la ficha de un
 * proyecto que salió de un hackatón enlaza con él, y al revés.
 */
import {
  EVENTS,
  PROJECTS,
  type EventEntry,
} from '../content/portfolio.ts'

export type WorkGroup = 'project' | 'event'

export interface Shot {
  src: string
  alt: string
  /** Ancho entre alto. El marco del visor toma esta forma. */
  ratio: number
}

export interface Work {
  id: string
  group: WorkGroup
  title: string
  /** Qué es, en pocas palabras, y para quién si se sabe. */
  what: string
  who: string
  text: string
  tech: string[]
  url?: string
  place: 1 | 2 | 3 | null
  /** El hackatón del que salió o que es: «HackaDisc 2025». */
  event?: string
  shots: Shot[]
  /** La otra ficha con la que se toca, y cómo se llama el enlace. */
  jump?: { label: string; to: string }
}

/** Las capturas de proyecto son 16:9; las fotos de los eventos, 3:2. */
export const SHOT_RATIO = 16 / 9
export const PHOTO_RATIO = 3 / 2

type ProjectLike = (typeof PROJECTS)[number]

/** «Gestión académica con IA · UCN» → qué es y para quién. */
export function splitSummary(summary: string): { what: string; who: string } {
  const [what, ...rest] = summary.split('·').map((part) => part.trim())
  return { what, who: rest.join(' · ') }
}

/** El nombre sin la coletilla del resultado («HackaDisc — 1.er lugar»): en la
 *  ficha el puesto va aparte, en su color. */
export const plainName = (name: string) => name.replace(/\s+—\s+.*$/, '')

const eventLabel = (event: EventEntry) => `${event.name} ${event.year}`
const eventId = (event: EventEntry) => `event:${event.id}`
const projectId = (id: string) => `project:${id}`

/** Un evento tiene ficha propia si subió al podio y hay fotos que enseñar. */
const hasCard = (event: EventEntry) => event.place !== null && (event.photos?.length ?? 0) > 0

export function buildWorks(projects: readonly ProjectLike[], events: readonly EventEntry[]): Work[] {
  const projectWorks: Work[] = projects.map((project) => {
    const { what, who } = splitSummary(project.summary)
    const from = events.find((event) => event.project === project.id)
    return {
      id: projectId(project.id),
      group: 'project',
      title: plainName(project.name),
      what,
      who,
      text: project.description,
      tech: project.tags,
      url: project.url,
      place: from?.place ?? null,
      event: from ? eventLabel(from) : undefined,
      shots: project.shot
        ? [{ src: project.shot, alt: `Captura de ${plainName(project.name)}`, ratio: SHOT_RATIO }]
        : [],
      jump: from && hasCard(from) ? { label: 'Ver el hackatón', to: eventId(from) } : undefined,
    }
  })

  const eventWorks: Work[] = events.filter(hasCard).map((event) => ({
    id: eventId(event),
    group: 'event',
    title: eventLabel(event),
    what: '',
    who: '',
    text: event.summary,
    tech: [],
    place: event.place,
    event: eventLabel(event),
    shots: (event.photos ?? []).map((photo) => ({
      src: photo.src,
      alt: photo.alt,
      ratio: photo.ratio ?? PHOTO_RATIO,
    })),
    jump:
      event.project && projects.some((project) => project.id === event.project)
        ? { label: 'Ver el proyecto', to: projectId(event.project) }
        : undefined,
  }))

  return [...projectWorks, ...eventWorks]
}

export const WORKS = buildWorks(PROJECTS, EVENTS)

export const PROJECT_WORKS = WORKS.filter((work) => work.group === 'project')

/** Los podios en el orden en que se dibujan: 2.º, 1.º, 3.º. */
export function podiumOrder(works: readonly Work[]): Work[] {
  const at = (place: number) => works.filter((work) => work.group === 'event' && work.place === place)
  return [...at(2), ...at(1), ...at(3)]
}

export const PODIUM_WORKS = podiumOrder(WORKS)

/** Los eventos sin podio, con el proyecto que salió de ellos si lo hay. */
export const OTHER_EVENTS = EVENTS.filter((event) => event.place === null).map((event) => ({
  label: eventLabel(event),
  projectWork: event.project ? projectId(event.project) : null,
}))

/**
 * La ficha a la que llevan las flechas: la siguiente de la MISMA sección,
 * dando la vuelta. Quien mira proyectos no cae de pronto en un hackatón.
 */
export function sibling(works: readonly Work[], id: string, delta: number): string {
  const here = works.find((work) => work.id === id)
  if (!here) throw new Error(`sibling: no hay ninguna ficha «${id}»`)
  const mates = works.filter((work) => work.group === here.group)
  const index = mates.indexOf(here)
  return mates[(((index + delta) % mates.length) + mates.length) % mates.length].id
}

/** Puesto dentro de su sección y cuántas son: «3 / 6». */
export function position(works: readonly Work[], id: string): { index: number; total: number } {
  const here = works.find((work) => work.id === id)
  if (!here) throw new Error(`position: no hay ninguna ficha «${id}»`)
  const mates = works.filter((work) => work.group === here.group)
  return { index: mates.indexOf(here) + 1, total: mates.length }
}

/**
 * El marco de la imagen: lo más grande que cabe en la caja con la forma de la
 * imagen. Tiene que tener su proporción exacta: la miniatura que viaja desde
 * la lista llega a esta caja, y con otra forma daría un salto al asentarse.
 */
export function fitFrame(
  ratio: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (!(ratio > 0) || !(maxWidth > 0) || !(maxHeight > 0)) return { width: 0, height: 0 }
  const width = Math.min(maxWidth, maxHeight * ratio)
  return { width, height: width / ratio }
}
