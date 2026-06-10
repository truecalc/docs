#!/usr/bin/env node
/**
 * lint-enrichment: validate enrichment/*.yaml against the contract and execute
 * every use_case formula against pinned @truecalc/core. Prints a coverage line.
 * Fails (exit 1) on any schema or formula error.
 *
 * No YAML dependency is assumed: enrichment files use a tiny, restricted YAML
 * subset parsed here. Keep files within that subset (see enrichment/_schema.md).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createEngine } from '@truecalc/core';

const require = createRequire(import.meta.url);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'enrichment');
const KNOWN_INDUSTRIES = new Set([
  'finance', 'lending', 'real-estate', 'personal-finance', 'operations',
  'sales', 'education', 'science', 'engineering', 'retail', 'hr',
]);

function fail(msg) { console.error(`enrichment lint: ${msg}`); process.exitCode = 1; }

function renderResult(r) {
  switch (r.type) {
    case 'number': return String(r.value);
    case 'text': return r.value;
    case 'bool': return r.value ? 'TRUE' : 'FALSE';
    case 'error': return r.error;
    case 'empty': return '(empty)';
    default: return String(r);
  }
}

if (!existsSync(dir)) { console.log('enrichment coverage: 0 files'); process.exit(0); }

const files = readdirSync(dir).filter((f) => f.endsWith('.yaml'));
const engine = createEngine('google-sheets');
let useCaseCount = 0;

for (const file of files) {
  const fn = basename(file, '.yaml');
  let doc;
  try {
    doc = parseRestrictedYaml(readFileSync(join(dir, file), 'utf8'));
  } catch (e) {
    fail(`${file}: parse error: ${e.message}`);
    continue;
  }
  for (const ind of doc.industries ?? []) {
    if (!KNOWN_INDUSTRIES.has(ind)) fail(`${file}: unknown industry tag "${ind}"`);
  }
  for (const uc of doc.use_cases ?? []) {
    if (!uc.title || !uc.formula) { fail(`${file}: use_case missing title/formula`); continue; }
    useCaseCount++;
    try {
      const r = engine.evaluate(uc.formula, {});
      if (r.type === 'error') fail(`${file}: use_case formula errored: ${uc.formula} => ${renderResult(r)}`);
    } catch (e) {
      fail(`${file}: use_case formula threw: ${uc.formula}: ${e.message}`);
    }
  }
  for (const q of doc.when_to_use ?? []) {
    if (!q.q || !q.a) fail(`${file}: when_to_use entry missing q/a`);
  }
}

console.log(`enrichment coverage: ${files.length} files, ${useCaseCount} use-case formulas executed`);

/** Minimal YAML subset parser — see enrichment/_schema.md. Supports the exact
 *  shapes used by enrichment files: top-level scalars, string[] inline arrays,
 *  and lists of flat {key: value} maps. Throws on anything outside the subset. */
function parseRestrictedYaml(text) {
  const { load } = require('./yaml-lite.cjs');
  return load(text);
}
