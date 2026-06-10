import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs')
const MANIFEST_PATH = path.join(process.cwd(), 'content', 'last-modified.json')
const BUILD_DATE = new Date().toISOString().slice(0, 10)
const cache = new Map<string, string>()

interface FileRef {
  path: string
  absolutePath?: string
}

let manifestCache: Record<string, string> | null = null
function manifest(): Record<string, string> {
  if (manifestCache) return manifestCache
  try {
    manifestCache = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Record<string, string>
  } catch {
    manifestCache = {}
  }
  return manifestCache
}

function manifestKey(ref: FileRef): string {
  const rel = ref.absolutePath
    ? path.relative(CONTENT_ROOT, ref.absolutePath)
    : ref.path.replace(/^docs\//, '')
  return rel.split(path.sep).join('/')
}

function resolveAbsolute(ref: FileRef): string {
  return ref.absolutePath ?? path.join(CONTENT_ROOT, ref.path.replace(/^docs\//, ''))
}

/** Last-modified date as YYYY-MM-DD. Resolution: manifest → git log → mtime → build date. */
export function getLastModified(ref: FileRef): string {
  const key = manifestKey(ref)
  const cached = cache.get(key)
  if (cached) return cached

  let date = manifest()[key]

  if (!date) {
    const absolutePath = resolveAbsolute(ref)
    try {
      const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', absolutePath], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      if (out) date = out
    } catch {
      // fall through to mtime
    }
    if (!date) {
      try {
        date = statSync(absolutePath).mtime.toISOString().slice(0, 10)
      } catch {
        date = BUILD_DATE
      }
    }
  }

  cache.set(key, date)
  return date
}

/** Same as getLastModified but returns a Date (for MetadataRoute.Sitemap). */
export function getLastModifiedDate(ref: FileRef): Date {
  return new Date(`${getLastModified(ref)}T00:00:00.000Z`)
}
