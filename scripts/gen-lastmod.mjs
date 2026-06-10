#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_ROOT = path.join(__dirname, '..', 'content', 'docs')
const OUT_PATH = path.join(__dirname, '..', 'content', 'last-modified.json')

function getAllFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((e) =>
    e.isDirectory()
      ? getAllFiles(path.join(dir, e.name))
      : e.name.endsWith('.mdx') || e.name.endsWith('.md')
        ? [path.join(dir, e.name)]
        : [],
  )
}

function gitDate(absolutePath) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', absolutePath], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out || null
  } catch {
    return null
  }
}

const today = new Date().toISOString().slice(0, 10)
const files = getAllFiles(CONTENT_ROOT)
const result = {}

for (const abs of files) {
  const key = path.relative(CONTENT_ROOT, abs).split(path.sep).join('/')
  result[key] = gitDate(abs) ?? statSync(abs).mtime.toISOString().slice(0, 10) ?? today
}

writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n')
console.log(`gen-lastmod: wrote ${Object.keys(result).length} entries to ${OUT_PATH}`)
