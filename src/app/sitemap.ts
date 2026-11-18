import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/content/site'

/** Una sola dirección: el sitio es una página. Las anclas del mundo no son
 *  páginas, y el CV va con `noindex`. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: 'monthly', priority: 1 }]
}
