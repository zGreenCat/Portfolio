import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import { CONTACT, COVER_ABOUT, LOCATION, PROJECTS } from '@/content/portfolio'
import { SITE_URL } from '@/content/site'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const name = 'Vicente Araya'
const role = 'Desarrollador full-stack'
const title = `${name} · ${role}`
/** Lo que sale bajo el enlace en un buscador y al compartirlo. Habla de él:
 *  la anterior describía el sitio («dentro de un mundo de bloques»). */
const description = `${name}, desarrollador full-stack e Ingeniero en Computación e Informática (UCN), en ${LOCATION.city}. Next.js, NestJS, FastAPI e IA aplicada; tres podios en hackatones.`

const link = (id: (typeof CONTACT)[number]['id']) => {
  const found = CONTACT.find((item) => item.id === id)
  if (!found) throw new Error(`CONTACT ya no tiene «${id}»`)
  return found.href
}

/**
 * Quién es, para los buscadores: lo que une este sitio con su GitHub y su
 * LinkedIn como una sola persona. Todo sale de `portfolio.ts`.
 */
const person = {
  '@context': 'https://schema.org',
  '@type': 'ProfilePage',
  url: `${SITE_URL}/`,
  inLanguage: 'es-CL',
  mainEntity: {
    '@type': 'Person',
    '@id': `${SITE_URL}/#vicente`,
    name,
    jobTitle: role,
    description: COVER_ABOUT.intro[0].trim(),
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/vicente.webp`,
    email: link('mail'),
    sameAs: [link('github'), link('linkedin')],
    address: {
      '@type': 'PostalAddress',
      addressLocality: LOCATION.city,
      addressCountry: LOCATION.countryCode,
    },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universidad Católica del Norte' },
    knowsAbout: [...new Set(PROJECTS.flatMap((project) => project.tags))],
  },
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  // La portada responde igual en `/`, `/index` y con cualquier `?…`.
  alternates: { canonical: '/' },
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'es_CL',
    url: '/',
    siteName: name,
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: 'Vicente Araya junto a su avatar de bloques, con el mismo polerón, y su nombre cruzando la pantalla',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og.jpg'],
  },
}

/** La clave es la de `storedTheme` (`src/world/daylight.ts`). */
const THEME_BOOT =
  "try{if(localStorage.getItem('tema')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}"

/** Quien vuelve de la 404 llega cayendo, sin portada. La clave y los valores
 *  son los de `src/world/fallIn.ts`; la página lo lee al montar y lo borra. */
const ARRIVAL_BOOT =
  "try{var a=sessionStorage.getItem('llegada');if((a==='mundo'||a==='portada')&&location.pathname==='/')document.documentElement.dataset.arrival=a}catch(e){}"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* El tema guardado se pone antes de pintar: sin esto, quien eligió
            oscuro veía un instante el claro al recargar. La página lo
            vuelve a leer al montar; esto solo adelanta los colores. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script
          type="application/ld+json"
          // `<` escapado: el texto sale de `portfolio.ts`, pero un `</script>`
          // dentro cerraría la etiqueta.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, '\\u003c') }}
        />
        {/* Y la llegada desde la 404, para que la portada no asome un
            instante antes de que la página la quite. */}
        <script dangerouslySetInnerHTML={{ __html: ARRIVAL_BOOT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
