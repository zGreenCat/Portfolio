/**
 * La dirección pública del sitio. Las redes y los buscadores no aceptan rutas
 * relativas: de aquí salen la imagen de previsualización, la dirección
 * canónica, el mapa del sitio y los datos estructurados. En Vercel sale del
 * entorno (`NEXT_PUBLIC_SITE_URL`); en local, del respaldo.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
