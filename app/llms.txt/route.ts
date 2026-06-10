import type { InferPageType } from 'fumadocs-core/source'
import { getLastModified } from '@/lib/last-modified'
import { source } from '@/lib/source'

export const revalidate = false

type Page = InferPageType<typeof source>

function getDesc(page: Page): string {
  const data = page.data as Record<string, unknown>
  return (data.llmsDescription as string | undefined) ?? page.data.description ?? page.data.title
}

function entry(page: Page): string {
  return `- [${page.data.title}](${page.url}): ${getDesc(page)}`
}

function section(heading: string, pages: Page[]): string[] {
  if (!pages.length) return []
  return [`## ${heading}`, '', ...pages.map(entry), '']
}

export async function GET() {
  const all = source.getPages()
  const by = (prefix: string) => all.filter((p) => p.url.startsWith(prefix))

  const lastUpdated = all
    .map((p) => getLastModified(p))
    .reduce((max, d) => (d > max ? d : max), '0000-00-00')

  const lines: string[] = [
    '# TrueCalc Documentation',
    '',
    'TrueCalc is a conformant spreadsheet formula evaluator — implements the full Google Sheets and Excel formula language in Rust, compiled to WebAssembly and published as an npm package (@truecalc/core) and Rust crate (truecalc-core). Use it to evaluate spreadsheet formulas in JavaScript, TypeScript, Rust, or any MCP-compatible environment.',
    '',
    ...section('Learn', by('/learn')),
    ...section('Reference — Functions', by('/reference/functions')),
    ...section('Reference', by('/reference').filter((p) => !p.url.startsWith('/reference/functions'))),
    ...section('API', by('/api')),
    '## Last updated',
    '',
    new Date(`${lastUpdated}T00:00:00.000Z`).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }),
  ]

  return new Response(lines.join('\n'))
}
