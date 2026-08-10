import type { Metadata } from 'next'
import Link from 'next/link'

import { ABOUT_PAGES, CONTACT, PROJECTS, RECIPES } from '@/content/portfolio'

import styles from './simple.module.css'

/**
 * Versión en texto del portfolio.
 *
 * No es un plan B por si el mundo recorrible no gusta: es lo que hace que el
 * trabajo exista para todo lo que no es una persona con ratón y paciencia. En
 * la portada los paneles se montan al acercarse caminando, así que el HTML que
 * se sirve no contiene ni un proyecto —ni buscadores, ni la previsualización de
 * un enlace en LinkedIn, ni un lector de pantalla llegan a verlos.
 *
 * Server component a propósito: cero JavaScript, cero animación, y el mismo
 * contenido que la portada porque los dos leen de `@/content/portfolio`.
 */

const title = 'Vicente Araya · Desarrollador full-stack'
const description =
  'Ingeniero en Computación e Informática. Proyectos, stack y contacto en una página de texto, sin animaciones.'

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/simple' },
  openGraph: { title, description, type: 'profile', locale: 'es_CL' },
}

/** Tecnologías de una receta, sin los huecos de aire de la rejilla 3×3. */
const techOf = (grid: (string | null)[]) => grid.filter((cell): cell is string => cell !== null)

export default function SimplePage() {
  return (
    <div className={styles.page}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>

      <header className={styles.header}>
        <p className={styles.eyebrow}>Portfolio · versión en texto</p>
        <h1 className={styles.name}>Vicente Araya</h1>
        <p className={styles.role}>Desarrollador full-stack</p>
        <p className={styles.intro}>{ABOUT_PAGES[0]}</p>

        <ul className={styles.contactRow}>
          {CONTACT.map((item) => (
            <li key={item.id}>
              <a
                className={styles.contactLink}
                href={item.href}
                {...('download' in item
                  ? { download: true }
                  : { target: '_blank', rel: 'noreferrer noopener' })}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main id="contenido" className={styles.main}>
        <section className={styles.section} aria-labelledby="sobre-mi">
          <h2 id="sobre-mi" className={styles.sectionTitle}>
            Sobre mí
          </h2>
          <div className={styles.prose}>
            {ABOUT_PAGES.slice(1).map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="proyectos">
          <h2 id="proyectos" className={styles.sectionTitle}>
            Proyectos
          </h2>
          <ol className={styles.projects}>
            {PROJECTS.map((project) => (
              <li key={project.id}>
                <article className={styles.project}>
                  <h3 className={styles.projectName}>
                    {project.url ? (
                      <a
                        className={styles.projectLink}
                        href={project.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {project.name}
                      </a>
                    ) : (
                      project.name
                    )}
                  </h3>
                  <p className={styles.projectSummary}>{project.summary}</p>
                  <p className={styles.projectText}>{project.description}</p>
                  <ul className={styles.tags}>
                    {project.tags.map((tag) => (
                      <li key={tag} className={styles.tag}>
                        {tag}
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="stack">
          <h2 id="stack" className={styles.sectionTitle}>
            Stack
          </h2>
          {/* Agrupado por lo que produce, no como lista plana de logos: saber
              que alguien conoce Redis dice poco; saber con qué lo combina y en
              qué proyecto lo usó, bastante más. */}
          <dl className={styles.stack}>
            {RECIPES.map((recipe) => (
              <div key={recipe.id} className={styles.stackRow}>
                <dt className={styles.stackTerm}>{recipe.result}</dt>
                <dd className={styles.stackBody}>
                  <p className={styles.stackTech}>{techOf(recipe.grid).join(' · ')}</p>
                  <p className={styles.stackNote}>{recipe.note}</p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section} aria-labelledby="contacto">
          <h2 id="contacto" className={styles.sectionTitle}>
            Contacto
          </h2>
          <ul className={styles.contactList}>
            {CONTACT.map((item) => (
              <li key={item.id} className={styles.contactItem}>
                <span className={styles.contactLabel}>{item.label}</span>
                <a
                  className={styles.contactValue}
                  href={item.href}
                  {...('download' in item
                    ? { download: true }
                    : { target: '_blank', rel: 'noreferrer noopener' })}
                >
                  {item.href.replace(/^mailto:/, '').replace(/^https?:\/\//, '')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          Esta página es la versión en texto. La principal es un mundo recorrible
          construido a mano: terreno por capas, sprites propios y navegación por perla de ender.
        </p>
        <Link href="/" className={styles.worldLink}>
          Ver el portfolio recorrible →
        </Link>
      </footer>
    </div>
  )
}
