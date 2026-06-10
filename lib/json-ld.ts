import { getLastModified } from '@/lib/last-modified'
import { source } from '@/lib/source'

type Page = NonNullable<ReturnType<typeof source.getPage>>
type PageType = 'learn' | 'reference' | 'api' | 'root'

function detectPageType(slugs: string[] | undefined): PageType {
  if (!slugs || slugs.length === 0) return 'root'
  if (slugs[0] === 'learn') return 'learn'
  if (slugs[0] === 'reference') return 'reference'
  if (slugs[0] === 'api') return 'api'
  return 'root'
}

const ORG_ID = 'https://truecalc.app/#organization'
const GLOSSARY_ID = 'https://docs.truecalc.app/reference/functions#glossary'
const PUBLISHER_REF = { '@id': ORG_ID }

function buildOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'TrueCalc',
    url: 'https://truecalc.app',
    sameAs: ['https://github.com/truecalc'],
  }
}

function buildTechArticle(page: Page, baseUrl: string) {
  const data = page.data as unknown as Record<string, unknown>
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.data.title,
    description: (data.seoDescription as string | undefined) ?? page.data.description,
    url: `${baseUrl}${page.url}`,
    author: PUBLISHER_REF,
    publisher: PUBLISHER_REF,
    dateModified: getLastModified(page),
  }
}

function buildDefinedTerm(page: Page, baseUrl: string) {
  const data = page.data as unknown as Record<string, unknown>
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${baseUrl}${page.url}#term`,
    name: page.data.title,
    description: (data.seoDescription as string | undefined) ?? page.data.description,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': GLOSSARY_ID,
      name: 'TrueCalc Formula Language',
      url: 'https://docs.truecalc.app/reference/functions',
    },
  }
}

function buildWebAPI(page: Page, baseUrl: string) {
  const data = page.data as unknown as Record<string, unknown>
  return {
    '@context': 'https://schema.org',
    '@type': 'WebAPI',
    name: page.data.title,
    description: (data.seoDescription as string | undefined) ?? page.data.description,
    url: `${baseUrl}${page.url}`,
    documentation: `${baseUrl}/api`,
    provider: PUBLISHER_REF,
  }
}

function buildFAQPage(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

function buildHowTo(page: Page, steps: Array<{ name: string; text: string }>) {
  const data = page.data as unknown as Record<string, unknown>
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: page.data.title,
    description: (data.seoDescription as string | undefined) ?? page.data.description,
    step: steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
  }
}

function buildBreadcrumb(page: Page, baseUrl: string) {
  const slugs = (page.slugs as unknown as string[] | undefined) ?? []
  const items: Array<{ '@type': 'ListItem'; position: number; name: string; item: string }> = []

  for (let i = 1; i <= slugs.length; i++) {
    const ancestor = source.getPage(slugs.slice(0, i))
    if (!ancestor) continue
    items.push({
      '@type': 'ListItem',
      position: items.length + 1,
      name: ancestor.data.title,
      item: `${baseUrl}${ancestor.url}`,
    })
  }

  if (items.length < 2) return undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

export function generateJsonLd(page: Page, baseUrl: string): object[] {
  const slugs = page.slugs as unknown as string[] | undefined
  const type = detectPageType(slugs)
  const data = page.data as unknown as Record<string, unknown>
  const faqItems = data.jsonLdFaq as Array<{ question: string; answer: string }> | undefined
  const howToSteps = data.jsonLdHowTo as Array<{ name: string; text: string }> | undefined

  const schemas: object[] = [buildOrganization()]

  switch (type) {
    case 'learn':
      schemas.push(buildTechArticle(page, baseUrl))
      if (howToSteps?.length) schemas.push(buildHowTo(page, howToSteps))
      if (faqItems?.length) schemas.push(buildFAQPage(faqItems))
      break
    case 'reference':
      schemas.push(buildTechArticle(page, baseUrl), buildDefinedTerm(page, baseUrl))
      if (faqItems?.length) schemas.push(buildFAQPage(faqItems))
      break
    case 'api':
      schemas.push(buildWebAPI(page, baseUrl))
      break
    default:
      schemas.push(buildTechArticle(page, baseUrl))
  }

  const breadcrumb = buildBreadcrumb(page, baseUrl)
  if (breadcrumb) schemas.push(breadcrumb)

  return schemas
}
