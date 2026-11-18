/**
 * Cómo se va de un sitio a otro al pulsar la barra, y qué se escribe en el
 * chat cuando toca hacerlo con `/tp`. Sin React, para poder probarlo.
 */

export type Teleport = 'pearl' | 'chat'

/** De pie, una de cada tres veces escribe el comando en vez de lanzar. */
export const CHAT_CHANCE = 1 / 3

interface Choice {
  /** Sentado en el acantilado o subido al podio: no está para lanzar nada. */
  settled: boolean
  /** Un número al azar entre 0 y 1. */
  roll: number
  /** `?tp=1` o `?tp=0` en la URL: siempre uno, para probar. */
  force?: Teleport | null
}

/**
 * Sentado o en el podio, siempre el comando: la perla se lanza de pie y de
 * perfil, y desde ahí el gesto no casaba con nada. De pie, casi siempre la
 * perla, y a veces el comando.
 */
export function pickTeleport({ settled, roll, force = null }: Choice): Teleport {
  if (force) return force
  if (settled) return 'chat'
  return roll < CHAT_CHANCE ? 'chat' : 'pearl'
}

/** «Sobre mí» → `sobre-mi`: como se escribiría el destino en un comando. */
export function slug(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const tpCommand = (label: string) => `/tp ${slug(label)}`

/** La respuesta del juego, tal como la da al teletransportar a alguien. */
export const tpReply = (label: string) => `Vicente fue teletransportado a ${label}`

/**
 * Con qué hoja teclea el comando, según cómo esté. De pie, sentado en el
 * cantil y arriba en el podio tienen cada uno la suya. A medio gesto
 * —sentándose, subiendo— no hay hoja que case: devuelve `null` y se queda
 * como está, que es un instante.
 *
 * `sit` y `podium` son cuánto lleva de cada gesto, de 0 a 1.
 */
export function typingSheet(sit: number, podium: number): 'type' | 'typeSit' | 'typePodium' | null {
  if (sit === 0 && podium === 0) return 'type'
  if (sit >= 1) return 'typeSit'
  if (podium >= 1) return 'typePodium'
  return null
}
