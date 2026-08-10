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

/** Ordenados por peso, no por cronología: lo primero es lo que más cuenta. */
export const PROJECTS: Project[] = [
  {
    id: 'portal-coloso',
    name: 'Portal Coloso',
    summary: 'Gestión académica con IA · UCN',
    description:
      'Plataforma web para automatizar procesos académico-administrativos de la FICG-UCN, desarrollada como proyecto Capstone. Gestiona justificativos, analiza documentos, clasifica y deriva correos automáticamente, y genera respuestas asistidas por IA sobre paneles de indicadores.',
    tags: ['Next.js', 'NestJS', 'TypeScript', 'PostgreSQL', 'Prisma', 'FastAPI', 'Redis', 'OpenAI'],
  },
  {
    id: 'nasa-space-apps',
    name: 'NASA Space Apps Challenge',
    summary: 'Exploración de literatura científica con RAG',
    description:
      'Plataforma para explorar más de 600 publicaciones de BioScience usando RAG y modelos de lenguaje para resumir y consultar. Incluye búsqueda, filtrado, visualización de documentos y navegación mediante un grafo de conocimiento. Como Team Lead coordiné la integración entre frontend y backend, y el despliegue.',
    tags: ['RAG', 'LLM', 'Knowledge Graphs', 'APIs', 'Vercel'],
    url: 'https://frontend-nasa.vercel.app/',
  },
  {
    id: 'hackadisc',
    name: 'HackaDisc — 1.er lugar',
    summary: 'Dashboard predictivo de cobranza · Insecap',
    description:
      'MVP construido en hackathon para analizar el comportamiento de pago de empresas clientes: estadísticas, detección de patrones de atraso y proyecciones para anticipar riesgo de impago. Incluyó un dashboard ejecutivo, un pipeline de datos y modelos de regresión. Primer lugar del desafío.',
    tags: ['Angular', 'FastAPI', 'Python', 'Data Analytics', 'Regresión'],
    url: 'https://front-end-hack-a-disc.vercel.app/home',
  },
  {
    id: 'smartpack',
    name: 'SmartPack',
    summary: 'Logística e inventario · Co-Founder',
    description:
      'Plataforma para digitalizar la gestión de inventario y las operaciones de bodega: áreas, bodegas, cajas, productos, proveedores y los procesos de picking y packing. Como Co-Founder y Technical Lead lideré el frontend, el sistema de roles y permisos, y participé en el modelo de datos y el backend.',
    tags: ['Next.js', 'NestJS', 'TypeScript', 'Tailwind', 'PostgreSQL', 'Prisma', 'Expo', 'Docker'],
    url: 'https://kreatracker.cl/login',
  },
  {
    id: 'postea',
    name: 'Postea',
    summary: 'SaaS de chatbot con IA · Shinsekai',
    description:
      'Plataforma SaaS que permite integrar un chatbot en sitios externos mediante un widget, con capacidades de IA generativa sobre Gemini 2.5. Desarrollado durante mi práctica profesional.',
    tags: ['Desarrollo Web', 'APIs', 'Gemini 2.5', 'IA generativa'],
  },
  {
    id: 'rincon-chilenito',
    name: 'El Rincón Chilenito',
    summary: 'E-commerce y POS · Shinsekai',
    description:
      'Solución que combina comercio electrónico con punto de venta para un negocio en contexto escolar, incluyendo gestión de productos y ventas. Desarrollado durante mi práctica profesional.',
    tags: ['E-commerce', 'POS', 'Full-Stack'],
  },
  {
    id: 'ekiproject',
    name: 'EkiProject',
    summary: 'Landing corporativa',
    description:
      'Diseño y desarrollo de la presencia web de EkiProject: presentación de la organización, sus proyectos y servicios en una interfaz moderna y responsive.',
    tags: ['Landing Page', 'Web'],
    url: 'https://www.ekiproject.cl/',
  },
]

export const CONTACT = [
  { id: 'github', label: 'GitHub', href: 'https://github.com/zGreenCat' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/vicente-araya-a1ab8528a',
  },
  { id: 'mail', label: 'Correo', href: 'mailto:vicente.araya9821@gmail.com' },
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
    note: 'Portal Coloso · NASA Space Apps · Postea',
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
