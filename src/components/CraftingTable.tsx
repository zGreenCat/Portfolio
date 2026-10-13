'use client'

import { RECIPES, TECH_KIND } from '@/content/portfolio'

import Panel from './Panel'
import styles from './CraftingTable.module.css'

interface CraftingTableProps {
  /** 0 = cerrado, 1 = abierto del todo. Lo gobierna la distancia. */
  openness: number
}

/**
 * Skills como recetas: qué combinación de tecnologías produce qué, y en qué
 * proyectos se usó.
 *
 * Sale de los stacks reales. Una lista plana de logos no dice nada; una receta
 * cuenta con qué se combina cada cosa y para qué sirvió.
 *
 * Las cinco se ven a la vez. Antes iban de una en una en una rejilla 3×3 y
 * había que pasar cuatro veces para verlas todas — con el cajón lateral hay
 * sitio de sobra y ese clic no compraba nada.
 */
export default function CraftingTable({ openness }: CraftingTableProps) {
  return (
    <Panel eyebrow="Mesa de crafteo" title="Skills" openness={openness}>
      <ul className={styles.recipes}>
        {RECIPES.map((recipe) => {
          const tech = recipe.grid.filter((cell): cell is string => cell !== null)
          return (
            <li key={recipe.id} className={styles.recipe}>
              <h3 className={styles.result}>{recipe.result}</h3>

              <ul className={styles.tech}>
                {tech.map((name) => (
                  <li key={name} className={`${styles.item} ${styles[TECH_KIND[name] ?? 'infra']}`}>
                    {name}
                  </li>
                ))}
              </ul>

              <p className={styles.note}>{recipe.note}</p>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
