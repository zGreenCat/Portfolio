import type { Project } from '@/components/Inventory'

/**
 * Contenido del portfolio. Separado de la página a propósito: el recorrido es
 * el envoltorio y esto es lo que se lee, y conviene poder cambiar uno sin
 * tocar el otro.
 */

/** Páginas del libro de "sobre mí". Cortas: se pasan, no se recorren. */
export const ABOUT_PAGES = [
  'Ingeniero en Computación e Informática. Construyo software que resuelve problemas concretos, del planteamiento del problema hasta una versión funcional y usable.',
  'Me muevo entre el desarrollo full-stack, la inteligencia artificial y el diseño de producto. He trabajado en plataformas web empresariales, sistemas académicos, soluciones SaaS y herramientas con IA.',
  'Portal Coloso, SmartPack, NASA Space Apps Challenge, HackaDisc. Proyectos para clientes reales y productos nacidos en mi experiencia profesional.',
  'Me gusta meterme en todo el proceso: entender el problema, diseñar la solución, definir la arquitectura, implementar y llevarlo hasta que funciona de verdad.',
  'También he asumido liderazgo técnico y coordinación de equipos, combinando el desarrollo con organización, comunicación y toma de decisiones.',
  'Busco proyectos desafiantes donde la tecnología tenga un propósito claro.',
]

/**
 * El «sobre mí» en la portada, partido en dos. Arriba, antes de los
 * proyectos, quién es en diez segundos; abajo, junto al contacto, cómo
 * trabaja y qué busca, para quien ya se interesó. El párrafo que enumera
 * proyectos se queda fuera: en la portada vienen justo debajo.
 *
 * Va por posición: si se reordena `ABOUT_PAGES`, revisar esto. Y si el primer
 * párrafo deja de empezar por el título, falla en vez de repetirlo en silencio.
 */
const DEGREE = 'Ingeniero en Computación e Informática'

/** El primer párrafo sin el título, que en la portada va en el arranque: una
 *  pantalla más abajo se leería dos veces. */
function withoutDegree(paragraph: string): string {
  const lead = `${DEGREE}. `
  if (!paragraph.startsWith(lead)) {
    throw new Error(`COVER_ABOUT: el primer párrafo de ABOUT_PAGES ya no empieza por «${lead}»`)
  }
  return paragraph.slice(lead.length)
}

export const COVER_ABOUT = {
  degree: DEGREE,
  intro: [withoutDegree(ABOUT_PAGES[0]), ABOUT_PAGES[1]],
  rest: ABOUT_PAGES.slice(3),
}

/** Ordenados por peso, no por cronología: lo primero es lo que más cuenta. */
export const PROJECTS: Project[] = [
  {
    id: 'portal-coloso',
    shot: '/projects/portal-coloso.webp',
    name: 'Portal Coloso',
    summary: 'Gestión académica con IA · UCN',
    description:
      'Plataforma web para automatizar procesos académico-administrativos de la FICG-UCN, desarrollada como proyecto Capstone. Gestiona justificativos, analiza documentos, clasifica y deriva correos automáticamente, y genera respuestas asistidas por IA sobre paneles de indicadores.',
    tags: ['Next.js', 'NestJS', 'TypeScript', 'PostgreSQL', 'Prisma', 'FastAPI', 'Redis', 'OpenAI'],
  },
  {
    id: 'nasa-space-apps',
    shot: '/projects/nasa-space-apps.webp',
    name: 'NASA Space Apps Challenge',
    summary: 'Exploración de literatura científica con RAG',
    description:
      'Plataforma para explorar más de 600 publicaciones de BioScience usando RAG y modelos de lenguaje para resumir y consultar. Incluye búsqueda, filtrado, visualización de documentos y navegación mediante un grafo de conocimiento. Coordiné la integración entre frontend y backend, y el despliegue.',
    tags: ['RAG', 'LLM', 'Knowledge Graphs', 'APIs', 'Vercel'],
    url: 'https://frontend-nasa.vercel.app/',
  },
  {
    id: 'hackadisc',
    shot: '/projects/hackadisc.webp',
    name: 'HackaDisc — 1.er lugar',
    summary: 'Dashboard predictivo de cobranza · Insecap',
    description:
      'MVP construido en hackathon para analizar el comportamiento de pago de empresas clientes: estadísticas, detección de patrones de atraso y proyecciones para anticipar riesgo de impago. Incluyó un dashboard ejecutivo, un pipeline de datos y modelos de regresión. Primer lugar del desafío.',
    tags: ['Angular', 'FastAPI', 'Python', 'Data Analytics', 'Regresión'],
    url: 'https://front-end-hack-a-disc.vercel.app/home',
  },
  {
    id: 'smartpack',
    shot: '/projects/smartpack.webp',
    name: 'SmartPack',
    summary: 'Logística e inventario · Co-Founder',
    description:
      'Plataforma para digitalizar la gestión de inventario y las operaciones de bodega: áreas, bodegas, cajas, productos, proveedores y los procesos de picking y packing. Como Co-Founder y Technical Lead lideré el frontend, el sistema de roles y permisos, y participé en el modelo de datos y el backend.',
    tags: ['Next.js', 'NestJS', 'TypeScript', 'Tailwind', 'PostgreSQL', 'Prisma', 'Expo', 'Docker'],
    url: 'https://kreatracker.cl/login',
  },
  {
    id: 'rincon-chilenito',
    shot: '/projects/rincon-chilenito.webp',
    name: 'El Rincón Chilenito',
    summary: 'E-commerce y POS · Shinsekai',
    description:
      'Solución que combina comercio electrónico con punto de venta para un negocio en contexto escolar, incluyendo gestión de productos y ventas. Desarrollado durante mi práctica profesional.',
    tags: ['E-commerce', 'POS', 'Full-Stack'],
  },
  {
    id: 'ekiproject',
    shot: '/projects/ekiproject.webp',
    name: 'EkiProject',
    summary: 'Landing corporativa',
    description:
      'Diseño y desarrollo de la presencia web de EkiProject: presentación de la organización, sus proyectos y servicios en una interfaz moderna y responsive.',
    tags: ['Landing Page', 'Web'],
    url: 'https://www.ekiproject.cl/',
  },
]

export interface EventEntry {
  id: string
  name: string
  year: number
  /** Puesto en el podio; `null` si se participó sin puesto. */
  place: 1 | 2 | 3 | null
  summary: string
  /** `id` del proyecto del inventario que salió de ahí, si lo hay. */
  project?: string
  /**
   * Fotos del evento, en `public/events/<id>-<n>.webp`. La primera es la
   * portada, y tiene además su miniatura en `<id>-thumb.webp`. Sin fotos, el
   * evento va solo con texto. El `alt` describe la escena y no nombra a nadie:
   * salen compañeros de equipo.
   */
  /** `ratio` (ancho entre alto) solo en las que no son 3:2, que es lo que
   *  da la cámara: el visor de la portada necesita la forma antes de cargar. */
  photos?: { src: string; alt: string; ratio?: number }[]
}

/** La miniatura de la portada de un evento, para el cajón del podio. */
export const eventThumb = (id: string) => `/events/${id}-thumb.webp`

/**
 * Hackatones. El podio del recorrido tiene tres escalones porque aquí hay tres
 * puestos: quien no lo tuvo no sube, va aparte. Sin rol en ninguno a
 * propósito: los equipos no los tenían definidos.
 */
export const EVENTS: EventEntry[] = [
  {
    id: 'hackadisc-2025',
    name: 'HackaDisc',
    year: 2025,
    place: 1,
    summary: 'Dashboard predictivo de cobranza para Insecap.',
    project: 'hackadisc',
    photos: [
      {
        src: '/events/hackadisc-2025-1.webp',
        alt: 'El equipo con el cheque de primer lugar de HackaDisc 2025',
      },
      {
        src: '/events/hackadisc-2025-2.webp',
        alt: 'Agradeciendo al micrófono con el cheque de primer lugar',
      },
      {
        src: '/events/hackadisc-2025-3.webp',
        alt: 'Presentando el dashboard frente al gráfico proyectado',
      },
    ],
  },
  {
    id: 'hackadisc-2024',
    name: 'HackaDisc',
    year: 2024,
    place: 2,
    summary: 'Dashboard con un LM predictivo para Pignus.',
    photos: [
      {
        src: '/events/hackadisc-2024-1.webp',
        alt: 'El equipo con el cheque de segundo lugar de HackaDisc 2024',
      },
      {
        src: '/events/hackadisc-2024-2.webp',
        alt: 'Presentando el proyecto junto al pendón de la universidad',
      },
      {
        src: '/events/hackadisc-2024-3.webp',
        alt: 'El dashboard construido para Pignus, con sus estadísticas por empresa',
        ratio: 1280 / 684,
      },
    ],
  },
  {
    id: 'hackamine-2026',
    name: 'Hackamine',
    year: 2026,
    place: 3,
    summary:
      'Tres casos de industria 4.0: arquitectura de alto nivel para modelos de machine learning, un ETL para un dashboard y el entrenamiento de un modelo predictivo.',
    photos: [
      {
        src: '/events/hackamine-2026-1.webp',
        alt: 'El equipo recibiendo el cheque de tercer lugar de Hackamine 2026',
      },
      {
        src: '/events/hackamine-2026-2.webp',
        alt: 'El equipo con las poleras de Hackamine',
      },
      {
        src: '/events/hackamine-2026-3.webp',
        alt: 'Los equipos premiados en el escenario de Hackamine',
      },
    ],
  },
  {
    id: 'nasa-space-apps-2025',
    name: 'NASA Space Apps Challenge',
    year: 2025,
    place: null,
    summary: 'Exploración de literatura científica con RAG.',
    project: 'nasa-space-apps',
  },
]

export const PLACE_LABEL: Record<1 | 2 | 3, string> = {
  1: '1.er lugar',
  2: '2.º lugar',
  3: '3.er lugar',
}

export const CONTACT = [
  { id: 'github', label: 'GitHub', href: 'https://github.com/zGreenCat' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/vicente-araya-a1ab8528a',
  },
  { id: 'mail', label: 'Correo', href: 'mailto:hola@vicente-araya.dev' },
  { id: 'cv', label: 'CV en PDF', href: '/cv-vicente-araya.pdf', download: true },
] as const

export interface Recipe {
  id: string
  /** 9 huecos de la rejilla 3×3. `null` es aire. */
  grid: (string | null)[]
  result: string
  note: string
}

/**
 * Recetas de la mesa de crafteo. Las tecnologías salen de los stacks reales de
 * los proyectos, agrupadas por lo que producen juntas: una lista plana de
 * iconos no dice nada, una receta sí.
 */
export const RECIPES: Recipe[] = [
  {
    id: 'frontend',
    grid: ['Next.js', 'React', 'TypeScript', null, 'Tailwind', null, null, 'Angular', null],
    result: 'Interfaz',
    note: 'Portal Coloso · SmartPack · HackaDisc',
  },
  {
    id: 'backend',
    grid: ['NestJS', 'FastAPI', 'Python', 'PostgreSQL', 'Prisma', 'Redis', null, 'BullMQ', null],
    result: 'API',
    note: 'Portal Coloso · SmartPack',
  },
  {
    id: 'ia',
    grid: ['OpenAI', 'Gemini', 'RAG', 'LLM', 'Knowledge Graphs', null, null, 'FastAPI', null],
    result: 'Producto con IA',
    note: 'Portal Coloso · NASA Space Apps',
  },
  {
    id: 'movil',
    grid: [null, 'Expo', null, 'React Native', 'TypeScript', null, null, null, null],
    result: 'App móvil',
    note: 'SmartPack',
  },
  {
    id: 'infra',
    grid: ['Docker', 'Vercel', 'GitHub', null, 'PostgreSQL', null, null, null, null],
    result: 'Despliegue',
    note: 'SmartPack · NASA Space Apps',
  },
]

/** Familia de cada tecnología, para colorear su hueco. */
export const TECH_KIND: Record<string, 'front' | 'back' | 'ia' | 'infra'> = {
  'Next.js': 'front',
  React: 'front',
  TypeScript: 'front',
  Tailwind: 'front',
  Angular: 'front',
  'React Native': 'front',
  Expo: 'front',
  NestJS: 'back',
  FastAPI: 'back',
  Python: 'back',
  PostgreSQL: 'back',
  Prisma: 'back',
  Redis: 'back',
  BullMQ: 'back',
  OpenAI: 'ia',
  Gemini: 'ia',
  RAG: 'ia',
  LLM: 'ia',
  'Knowledge Graphs': 'ia',
  Docker: 'infra',
  Vercel: 'infra',
  GitHub: 'infra',
}

/**
 * Este sitio, como un proyecto más de la portada. Fue una sección propia
 * («El mundo también es ingeniería») con tres cifras grandes: hablaba de la
 * página y no de Vicente, y repetía la entrada al mundo. Va solo en la
 * portada: en el mundo el cofre enseña los proyectos de `PROJECTS`.
 *
 * Las afirmaciones salen de mediciones anotadas en `CLAUDE.md`.
 */
export const SITE_PROJECT = {
  id: 'portfolio',
  shot: '/projects/portfolio.webp',
  name: 'Este portfolio',
  summary: 'Sitio personal · Código abierto',
  description:
    'Una portada para leer en un minuto y, detrás, un mundo de cinco biomas que se recorre caminando. El scroll es una posición y no una línea de tiempo, así que nada se desincroniza al volver atrás. Las animaciones del personaje se renderizan con Blender desde código. En un portátil con gráfica integrada lo llevé de 39 a 60 fps midiendo dónde se iba el tiempo.',
  tags: ['Next.js', 'React', 'TypeScript', 'Blender'],
  repo: 'https://github.com/zGreenCat/Portfolio',
} as const

export interface Job {
  id: string
  role: string
  /** Empresa o proyecto, y para quién si hace falta. */
  place: string
  /** El año en que empezó: bajo ese año va en la línea de tiempo. */
  year: number
  /** Los meses, como se leen: «Oct – hoy». */
  when: string
  /** Sigue hoy. */
  current: boolean
  text: string
}

/**
 * La trayectoria, para la línea de tiempo de la portada. Del más reciente al
 * más antiguo. Sale del CV de Vicente (`public/cv-vicente-araya.pdf`): los
 * cargos van acortados y cada línea es un resumen; el detalle está allí. Si
 * cambia el CV, cambia esto.
 */
export const EXPERIENCE: Job[] = [
  {
    id: 'ats-jogglar',
    role: 'Frontend e integración de IA',
    place: 'Plataforma ATS para Jogglar · EKI',
    year: 2026,
    when: 'Nov – hoy',
    current: true,
    text: 'Frontend en Next.js y procesamiento de currículums con OCR y modelos de lenguaje, en un equipo de cuatro.',
  },
  {
    id: 'thermosolutions',
    role: 'Ingeniero en IA y arquitectura cloud',
    place: 'Thermosolutions',
    year: 2026,
    when: 'Oct – hoy',
    current: true,
    text: 'Integro IA en productos para la minería: un asistente de flota con RAG, el resumen por voz de las bitácoras de turno y el despliegue en AWS.',
  },
  {
    id: 'incidente-seguridad',
    role: 'Consultor en ciberseguridad',
    place: 'EKI',
    year: 2026,
    when: 'Jul',
    current: false,
    text: 'Respuesta a un incidente en un sitio WordPress: 1.651 publicaciones maliciosas eliminadas y el vector de entrada cerrado.',
  },
  {
    id: 'portal-coloso',
    role: 'Full-stack y líder técnico',
    place: 'Portal Coloso · UCN',
    year: 2026,
    when: 'Abr – Jul',
    current: false,
    text: 'Gestión académica con IA para la Facultad de Ingeniería. Hoy en producción en la universidad.',
  },
  {
    id: 'smartpack',
    role: 'Cofundador y líder de equipo',
    place: 'SmartPack · EKI',
    year: 2025,
    when: 'Oct – hoy',
    current: true,
    text: 'Inventario y logística de bodegas: la web en Next.js, la app en Expo y el API en NestJS.',
  },
  {
    id: 'shinsekai',
    role: 'Desarrollador full-stack',
    place: 'Shinsekai',
    year: 2025,
    when: 'Jul – Sep',
    current: false,
    text: 'El punto de venta de El Rincón Chilenito: modelo de datos, APIs y frontend.',
  },
  {
    id: 'ayudantia',
    role: 'Ayudante de Ingeniería de Software',
    place: 'Universidad Católica del Norte',
    year: 2025,
    when: 'Mar – Ago',
    current: false,
    text: 'Apoyo a la docencia práctica del curso.',
  },
  {
    id: 'technovation',
    role: 'Mentor voluntario',
    place: 'Technovation Girls Chile',
    year: 2024,
    when: 'Mar – Jul',
    current: false,
    text: 'Guié a un equipo de niñas en la creación de una app, del requerimiento al pitch.',
  },
]

export const EDUCATION =
  'Ingeniería en Computación e Informática, Universidad Católica del Norte. Titulado en 2026.'
