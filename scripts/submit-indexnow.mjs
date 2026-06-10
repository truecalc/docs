#!/usr/bin/env node
const HOST = 'docs.truecalc.app'
const KEY = process.env.INDEXNOW_KEY
if (!KEY) { console.error('INDEXNOW_KEY not set'); process.exit(1) }
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
const SITEMAP_URL = `https://${HOST}/sitemap.xml`
const DEFAULT_SINCE_DAYS = 2

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const all = args.includes('--all')

async function fetchSitemapEntries() {
  const res = await fetch(SITEMAP_URL)
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`)
  const xml = await res.text()
  const entries = []
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1]
    if (!loc) continue
    const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]
    entries.push({ loc, lastmod })
  }
  return entries
}

function selectUrls(entries, sinceDays, submitAll) {
  if (submitAll) return entries.map((e) => e.loc)
  const cutoff = Date.now() - sinceDays * 24 * 60 * 60 * 1000
  return entries
    .filter((e) => {
      if (!e.lastmod) return true
      const t = Date.parse(e.lastmod)
      return Number.isNaN(t) ? true : t >= cutoff
    })
    .map((e) => e.loc)
}

const entries = await fetchSitemapEntries()
const urls = selectUrls(entries, DEFAULT_SINCE_DAYS, all)

if (urls.length === 0) {
  console.log('No URLs to submit.')
  process.exit(0)
}

if (dryRun) {
  console.log(`[dry-run] Would submit ${urls.length} URL(s):`)
  urls.forEach((u) => console.log(' ', u))
  process.exit(0)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
})
console.log(`IndexNow: ${res.status} — submitted ${urls.length} URL(s)`)
