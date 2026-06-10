export const dynamic = 'force-static'

import type { MetadataRoute } from 'next'
import { getLastModifiedDate } from '@/lib/last-modified'
import { source } from '@/lib/source'

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://docs.truecalc.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    url: `${baseUrl}${page.url}`,
    lastModified: getLastModifiedDate(page),
    changeFrequency: 'weekly' as const,
    priority: (page.slugs?.length ?? 0) === 0 ? 1.0 : 0.8,
  }))
}
