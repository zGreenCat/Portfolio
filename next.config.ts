import type { NextConfig } from 'next'

/**
 * Lo que el sitio carga de verdad: todo sale de su propio dominio —scripts,
 * estilos, fuentes (las de `next/font` se alojan aquí), imágenes, sonidos— y
 * no hay marcos, workers ni servicios de fuera.
 *
 * Lleva `'unsafe-inline'` porque la página se sirve estática: Next mete sus
 * scripts de arranque en línea, `layout.tsx` otros dos (tema y llegada), y el
 * render del servidor escribe atributos `style`. Quitarlo pide un nonce por
 * petición, y con eso la página deja de poder cachearse en el borde. Así
 * sigue cerrando lo que importa: scripts de otros dominios, `<object>`,
 * `<base>`, que la enmarquen y que un formulario envíe fuera.
 *
 * En desarrollo React necesita `eval` para recargar en caliente.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

/**
 * Un día, y una semana más sirviendo lo guardado mientras se revalida por
 * detrás. Vercel manda `public/` con `max-age=0`: cada visita revalidaba
 * capa por capa y hoja por hoja, y la descarga en segundo plano ahorraba
 * bytes pero no la espera.
 *
 * No es `immutable` porque estos archivos no llevan huella en el nombre:
 * `render_all.sh` reescribe una hoja con el mismo nombre. El precio es que
 * una hoja o una capa cambiada puede tardar hasta un día en llegar a quien
 * ya visitó el sitio. La foto, el CV y la imagen de previsualización quedan
 * fuera: se cambian con el mismo nombre y tienen que verse en el acto.
 */
const ASSET_CACHE = 'public, max-age=86400, stale-while-revalidate=604800'
const CACHED = ['layers', 'sprites', 'textures', 'end', 'events', 'projects', 'fonts', 'sounds']

const nextConfig: NextConfig = {
  // Nada usa `next/image`, pero su optimizador responde igual en
  // `/_next/image`: cualquiera podía pedirle transformaciones de lo que hay
  // en `public/`. Apagado.
  images: { unoptimized: true },

  // `/simple` fue la versión en texto. La portada ya lleva todo el contenido
  // en el HTML servido, y los enlaces compartidos tienen que seguir llegando.
  async redirects() {
    return [{ source: '/simple', destination: '/', permanent: true }]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // `clipboard-write` se queda: lo usa el medidor de `?fps`.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
      ...CACHED.map((folder) => ({
        source: `/${folder}/:path*`,
        headers: [{ key: 'Cache-Control', value: ASSET_CACHE }],
      })),
      // El CV se descarga desde el sitio, pero no sale en buscadores: ahí
      // competía con la portada por su nombre, y enseñaba el teléfono.
      {
        source: '/cv-vicente-araya.pdf',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
    ]
  },
}

export default nextConfig
