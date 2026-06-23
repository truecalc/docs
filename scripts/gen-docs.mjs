#!/usr/bin/env node
/**
 * gen-docs: regenerate content/docs/reference/functions/ from the engine's
 * functions.json registry (single source of truth, lives in truecalc/core).
 *
 * CI runs this and fails on drift (`git diff --exit-code`), so generated pages
 * must never be edited by hand.
 *
 * PINNED_CORE_REF: the git ref of truecalc/core that functions.json is fetched
 * from. TODO(version-pin): point this at the release tag matching the
 * @truecalc/core version pinned in package.json once functions.json is
 * populated and tagged (it is currently an empty array on main; see
 * truecalc/core#14).
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { load: parseYaml } = require('./yaml-lite.cjs');

// Advance via version-bump PRs only (CLAUDE.md version-pin rule).
const PINNED_CORE_REF = 'c5e47017f0768de3f344e4009941b2a0c75bd6a7';
const FUNCTIONS_JSON_URL =
  process.env.FUNCTIONS_JSON_URL ??
  `https://raw.githubusercontent.com/truecalc/core/${PINNED_CORE_REF}/functions.json`;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'content', 'docs', 'reference', 'functions');
const enrichmentDir = join(root, 'enrichment');
const industriesDir = join(root, 'content', 'docs', 'industries');

/**
 * Load curated enrichment (`enrichment/<NAME>.yaml`) keyed by UPPERCASE function
 * name. Enrichment is authored in the docs repo and CI-linted by
 * scripts/lint-enrichment.mjs (which executes every use_case formula), so it is
 * as trustworthy as the registry it merges into.
 */
function loadEnrichment() {
  const map = new Map();
  if (!existsSync(enrichmentDir)) return map;
  for (const file of readdirSync(enrichmentDir)) {
    if (!file.endsWith('.yaml')) continue;
    const name = basename(file, '.yaml').toUpperCase();
    map.set(name, parseYaml(readFileSync(join(enrichmentDir, file), 'utf8')));
  }
  return map;
}

/** Escape characters that MDX would treat as JSX/expressions. */
function mdxEscape(text) {
  return String(text ?? '')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * A formula is "self-contained" if it has no cell or sheet references, so the
 * stateless engine behind <TryIt> can run it. Mirrors is_self_contained in the
 * core xtask: rejects sheet refs (`!`), the INDIRECT family, and A1-style cell
 * references (1–3 letters immediately followed by a digit, unless it's a
 * function name like LOG10). Inline array literals like {1,2;3,4} stay runnable.
 */
function isSelfContained(formula) {
  const f = String(formula);
  if (f.includes('!') || f.toUpperCase().includes('INDIRECT')) return false;
  for (let i = 0; i < f.length; i++) {
    if (/[0-9]/.test(f[i]) && i > 0 && /[A-Za-z]/.test(f[i - 1])) {
      let j = i - 1;
      while (j > 0 && /[A-Za-z]/.test(f[j - 1])) j -= 1;
      const prevOk = j === 0 || !/[A-Za-z0-9]/.test(f[j - 1]);
      const letterRun = i - j;
      let k = i;
      while (k < f.length && /[0-9]/.test(f[k])) k += 1;
      // A digit-run followed by '(' or a letter is part of an identifier
      // (a function name like LOG10 or BIN2DEC), not an A1-style cell reference.
      const isIdentifier = k < f.length && (f[k] === '(' || /[A-Za-z]/.test(f[k]));
      if (prevOk && !isIdentifier && letterRun >= 1 && letterRun <= 3) return false;
    }
  }
  return true;
}

/**
 * A registry example is "reproducible" on a reference page only if a reader can
 * run it as-is: self-contained (no cell/sheet refs) AND containing no bare
 * identifier (a named range like `PRICES`). A bare identifier is any name token
 * that is not a function call (`NAME(`) and not a boolean literal — these come
 * from fixtures built on named ranges (`=SUM(PRICES) // => 60`) and are opaque.
 */
function isReproducibleExample(formula) {
  if (!isSelfContained(formula)) return false;
  // Blank out string literals so identifiers inside text aren't inspected.
  const noStrings = String(formula).replace(/"[^"]*"/g, '""');
  const idRe = /[A-Za-z_][A-Za-z0-9_.]*/g;
  let m;
  while ((m = idRe.exec(noStrings)) !== null) {
    const after = noStrings[m.index + m[0].length];
    if (after === '(') continue; // function call
    if (/^(TRUE|FALSE)$/i.test(m[0])) continue; // boolean literal
    return false; // a bare name → named range / external reference
  }
  return true;
}

function functionPage(fn, enrich) {
  const e = enrich ?? {};
  const useCases = Array.isArray(e.use_cases) ? e.use_cases : [];
  const whenToUse = Array.isArray(e.when_to_use) ? e.when_to_use : [];
  const industries = Array.isArray(e.industries) ? e.industries : [];

  const lines = [];
  lines.push('---');
  lines.push(`title: ${JSON.stringify(String(fn.name))}`);
  const desc = String(fn.description ?? '').replaceAll('\n', ' ').trim();
  lines.push(`description: ${JSON.stringify(desc)}`);
  const fnName = String(fn.name)
  const seoTitle = `${fnName}: Spreadsheet Function in Google Sheets & Excel`
  const seoDesc = `TrueCalc \`${fnName}\` — conformant with Google Sheets and Excel. ${desc.slice(0, 100)}`.slice(0, 160)
  const llmsDesc = e?.llms_description
    ? String(e.llms_description).slice(0, 250)
    : `TrueCalc ${fnName} function: ${desc.slice(0, 120)} Google Sheets/Excel conformant with fixture-verified behavior.`.slice(0, 200)
  lines.push(`seoTitle: ${JSON.stringify(seoTitle)}`)
  lines.push(`seoDescription: ${JSON.stringify(seoDesc)}`)
  lines.push(`llmsDescription: ${JSON.stringify(llmsDesc)}`)
  if (fn.category) lines.push(`category: ${JSON.stringify(String(fn.category))}`)
  // when_to_use → FAQPage structured data (rendered by lib/json-ld.ts).
  if (whenToUse.length > 0) {
    const faq = whenToUse.map((w) => ({ question: String(w.q), answer: String(w.a) }));
    lines.push(`jsonLdFaq: ${JSON.stringify(faq)}`); // JSON is valid YAML flow syntax
  }
  lines.push('---');
  lines.push('');
  lines.push(
    '{/* GENERATED by scripts/gen-docs.mjs from functions.json + enrichment/ — do not edit. */}',
  );
  lines.push('');
  // Headline widget: prefer a curated, runnable use-case formula; else the first
  // self-contained registry example. The use-case promoted to the headline is
  // not repeated in the "Use cases" section below (avoids a duplicate widget).
  const headlineUseCase = useCases.find((u) => u.formula && isSelfContained(u.formula));
  const exampleRunnable = Array.isArray(fn.examples)
    ? fn.examples.find((ex) => isSelfContained(ex.formula))
    : undefined;
  const headline = headlineUseCase?.formula ?? exampleRunnable?.formula;
  const useCasesToShow = headlineUseCase
    ? useCases.filter((u) => u !== headlineUseCase)
    : useCases;
  if (headline || useCasesToShow.length > 0) {
    lines.push("import { TryIt } from '@/components/try-it';");
    lines.push('');
  }
  if (headline) {
    lines.push('## Try it');
    lines.push('');
    lines.push(`<TryIt formula={${JSON.stringify(String(headline))}} />`);
    lines.push('');
  }
  if (whenToUse.length > 0) {
    lines.push('## When to use it');
    lines.push('');
    for (const w of whenToUse) {
      lines.push(`### ${mdxEscape(String(w.q))}`);
      lines.push('');
      lines.push(mdxEscape(String(w.a)));
      lines.push('');
    }
  }
  if (useCasesToShow.length > 0) {
    lines.push('## Use cases');
    lines.push('');
    for (const u of useCasesToShow) {
      if (u.title) lines.push(`**${mdxEscape(String(u.title))}**`);
      lines.push('');
      if (u.formula) {
        if (isSelfContained(u.formula)) {
          lines.push(`<TryIt formula={${JSON.stringify(String(u.formula))}} />`);
        } else {
          lines.push('```formula');
          lines.push(String(u.formula));
          lines.push('```');
        }
        lines.push('');
      }
    }
  }
  if (industries.length > 0) {
    lines.push('## Used in');
    lines.push('');
    lines.push(
      industries.map((t) => `[${mdxEscape(String(t))}](/industries/${slugify(t)})`).join(' · '),
    );
    lines.push('');
  }
  if (fn.syntax) {
    lines.push('## Syntax');
    lines.push('');
    lines.push('```');
    lines.push(String(fn.syntax));
    lines.push('```');
    lines.push('');
  }
  if (Array.isArray(fn.arguments) && fn.arguments.length > 0) {
    lines.push('## Arguments');
    lines.push('');
    lines.push('| Name | Type | Required | Description |');
    lines.push('| --- | --- | --- | --- |');
    for (const a of fn.arguments) {
      lines.push(
        `| \`${mdxEscape(a.name)}\` | ${mdxEscape(a.type)} | ${a.required ? 'yes' : 'no'} | ${mdxEscape(a.description)} |`,
      );
    }
    lines.push('');
  }
  if (fn.returns) {
    lines.push('## Returns');
    lines.push('');
    lines.push(`${mdxEscape(fn.returns.type)} — ${mdxEscape(fn.returns.description)}`);
    lines.push('');
  }
  // Only show self-contained examples: fixture examples that reference named
  // ranges or cells (e.g. `=SUM(PRICES)`) are opaque and non-reproducible on a
  // reference page, so they are filtered out. If none remain, omit the section.
  const shownExamples = Array.isArray(fn.examples)
    ? fn.examples.filter((ex) => isReproducibleExample(ex.formula))
    : [];
  if (shownExamples.length > 0) {
    lines.push('## Examples');
    lines.push('');
    lines.push('```formula');
    for (const ex of shownExamples) {
      lines.push(`${ex.formula} // => ${ex.result}`);
    }
    lines.push('```');
    lines.push('');
  }
  if (Array.isArray(fn.errors) && fn.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const e of fn.errors) lines.push(`- ${mdxEscape(e)}`);
    lines.push('');
  }
  if (fn.notes) {
    lines.push('## Notes');
    lines.push('');
    lines.push(mdxEscape(fn.notes));
    lines.push('');
  }
  return lines.join('\n');
}

/** Humanize an industry tag: "personal-finance" → "Personal finance". */
function humanize(tag) {
  const s = String(tag).replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate the By-Industry hub pages from the enrichment `industries:` tags.
 * Each hub lists the functions tagged with that industry. Skipped entirely when
 * no enrichment supplies industries (no empty tab).
 */
function writeIndustryHubs(byIndustry) {
  rmSync(industriesDir, { recursive: true, force: true });
  if (byIndustry.size === 0) return;
  mkdirSync(industriesDir, { recursive: true });

  const tags = [...byIndustry.keys()].sort();
  for (const tag of tags) {
    const label = humanize(tag);
    const fns = byIndustry.get(tag).sort((a, b) => (a.name < b.name ? -1 : 1));
    const body = [
      '---',
      `title: ${JSON.stringify(label)}`,
      `description: ${JSON.stringify(`Spreadsheet functions for ${label.toLowerCase()} — conformant with Google Sheets and Excel.`)}`,
      `seoTitle: ${JSON.stringify(`${label} Spreadsheet Functions (Google Sheets & Excel)`)}`,
      '---',
      '',
      '{/* GENERATED by scripts/gen-docs.mjs from enrichment/ — do not edit. */}',
      '',
      `Functions commonly used in ${label.toLowerCase()}:`,
      '',
      ...fns.map((f) => `- [${f.name}](/reference/functions/${f.slug})`),
      '',
    ].join('\n');
    writeFileSync(join(industriesDir, `${slugify(tag)}.mdx`), body + '\n');
  }

  const indexBody = [
    '---',
    'title: By industry',
    'description: "Spreadsheet functions grouped by the industries and tasks that use them."',
    '---',
    '',
    '{/* GENERATED by scripts/gen-docs.mjs from enrichment/ — do not edit. */}',
    '',
    'Browse spreadsheet functions by the work you do:',
    '',
    ...tags.map((t) => `- [${humanize(t)}](/industries/${slugify(t)})`),
    '',
  ].join('\n');
  writeFileSync(join(industriesDir, 'index.mdx'), indexBody + '\n');

  writeFileSync(
    join(industriesDir, 'meta.json'),
    JSON.stringify(
      { title: 'By industry', root: true, pages: ['index', ...tags.map((t) => slugify(t))] },
      null,
      2,
    ) + '\n',
  );
}

async function main() {
  let raw;
  if (process.env.FUNCTIONS_JSON_FILE) {
    raw = readFileSync(process.env.FUNCTIONS_JSON_FILE, 'utf8');
  } else {
    const res = await fetch(FUNCTIONS_JSON_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${FUNCTIONS_JSON_URL}: HTTP ${res.status}`);
    }
    raw = await res.text();
  }
  const functions = JSON.parse(raw);
  if (!Array.isArray(functions)) {
    throw new Error('functions.json must be a JSON array');
  }
  functions.sort((a, b) => {
    const an = String(a.name);
    const bn = String(b.name);
    return an < bn ? -1 : an > bn ? 1 : 0;
  });

  const enrichment = loadEnrichment();

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // industry tag -> [{ name, slug }] for the By-Industry hubs.
  const byIndustry = new Map();

  const slugs = [];
  for (const fn of functions) {
    if (!fn || typeof fn.name !== 'string' || fn.name.length === 0) {
      throw new Error(`Invalid registry entry: ${JSON.stringify(fn)}`);
    }
    const slug = slugify(fn.name);
    if (slugs.includes(slug)) throw new Error(`Duplicate function slug: ${slug}`);
    slugs.push(slug);
    const enrich = enrichment.get(String(fn.name).toUpperCase());
    writeFileSync(join(outDir, `${slug}.mdx`), functionPage(fn, enrich) + '\n');
    for (const tag of enrich?.industries ?? []) {
      const key = String(tag);
      if (!byIndustry.has(key)) byIndustry.set(key, []);
      byIndustry.get(key).push({ name: fn.name, slug });
    }
  }

  writeIndustryHubs(byIndustry);

  const indexBody = [
    '---',
    'title: Functions',
    `description: "Reference pages for every TrueCalc function, generated from the engine's functions.json registry."`,
    '---',
    '',
    '{/* GENERATED by scripts/gen-docs.mjs from functions.json — do not edit. */}',
    '',
    functions.length === 0
      ? `The function registry (\`functions.json\` in truecalc/core at \`${PINNED_CORE_REF}\`) is not populated yet — function pages will appear here automatically once it is (tracked in truecalc/core#14).`
      : `${functions.length} functions. Generated from \`functions.json\` in truecalc/core at \`${PINNED_CORE_REF}\`.`,
    '',
  ].join('\n');
  writeFileSync(join(outDir, 'index.mdx'), indexBody + '\n');

  writeFileSync(
    join(outDir, 'meta.json'),
    JSON.stringify({ title: 'Functions', pages: ['index', ...slugs] }, null, 2) + '\n',
  );

  console.log(`gen-docs: wrote ${functions.length} function page(s) + index to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
