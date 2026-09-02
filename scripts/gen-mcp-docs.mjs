#!/usr/bin/env node
/**
 * gen-mcp-docs: regenerate content/docs/api/mcp/ from a snapshot of the
 * native MCP server's per-tool JSON Schemas.
 *
 * SOURCE GAP (mirrors gen-docs.mjs's own PINNED_CORE_REF TODO): the schema
 * data lives in TrueCalc's private commercial-layer repo, so this script
 * does NOT fetch it the way gen-docs.mjs fetches functions.json from the
 * public truecalc/core over raw.githubusercontent.com. Instead
 * scripts/mcp-source/tool-schemas.json is a manually-placed, committed
 * snapshot (66 tools as of writing). TODO(mcp-schema-fetch): automate this
 * once the source repo can publish schema dumps somewhere this (public)
 * repo can fetch from without private-repo access -- a GitHub App/token with
 * read access, or a public release asset. Until then, refreshing these
 * pages means re-copying scripts/mcp-source/tool-schemas.json by hand and
 * re-running this script.
 *
 * The schema descriptions are Rust doc comments written for the crate's own
 * contributors, not for a docs reader: they reference internal types
 * (`EditSetCellSchema`), rustdoc intra-doc links, source files
 * (`envelope.ts`), and internal issue IDs (`pro#120`). See cleanText() /
 * summaryFor() below for how this script separates user-facing meaning from
 * that implementation narration, and falls back to a plain description
 * derived from the tool's own wire name rather than publishing anything
 * unsalvageable.
 *
 * CI runs this and fails on drift (`git diff --exit-code -- content/docs/api/mcp`),
 * so generated pages must never be edited by hand.
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = join(root, 'scripts', 'mcp-source', 'tool-schemas.json');
const outDir = join(root, 'content', 'docs', 'api', 'mcp');

// ---------------------------------------------------------------------------
// Text cleanup: separate user-facing meaning from Rust-implementation
// narration in a JSON Schema `description` field.
// ---------------------------------------------------------------------------

/** Escape characters MDX would treat as JSX/expressions, but only OUTSIDE
 * inline-code spans (backtick content is inert in MDX and must survive
 * untouched -- escaping braces there would corrupt things like an inline
 * `{}` example). */
function mdxEscape(text) {
  const parts = String(text).split(/(`[^`]*`)/g);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replaceAll('{', '&#123;').replaceAll('}', '&#125;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    )
    .join('');
}

/**
 * Does this clause read as internal-implementation narration rather than
 * user-facing meaning? Matches:
 *  - rustdoc intra-doc links: [`Name`]
 *  - backticked PascalCase identifiers / crate paths: `CellRange`, `crate::commands`
 *  - backticked snake_case function names: `resolve_range`
 *  - backticked source filenames: `envelope.ts`
 *  - backticked internal issue refs: `pro#120`
 *  - attribute macros: #[derive(TS)]
 *  - a fixed set of narration phrases this codebase's doc comments use to
 *    talk about their own history/structure rather than the tool's behavior.
 */
function isJargon(clause) {
  const patterns = [
    /\[`[^`]+`\]/, // intra-doc link
    /`[A-Z][A-Za-z0-9]*(::[A-Za-z0-9_]+)*`/, // `CellRange`, `EditSetCellSchema`
    /`[a-z][a-z0-9]*(_[a-z0-9]+)+`/, // `resolve_range`, `is_empty`
    /`[A-Za-z0-9_-]+\.(ts|rs)`/, // `envelope.ts`
    /`[a-z]+#\d+`/, // `pro#120`
    /#\[[a-zA-Z]/, // #[derive(TS)]
    /`[a-z][a-zA-Z0-9]*:[a-zA-Z]+`'s (wire|own)/, // `file:import`'s wire format / own extra payload
  ];
  if (patterns.some((re) => re.test(clause))) return true;
  const phrases = [
    'ported from',
    'ported field-by-field',
    'own doc',
    'module doc',
    'this module',
    'this file',
    'this crate',
    'this pr',
    'grep confirms',
    'batch 0',
    'ts-rs',
    'serde',
    'wire payload',
    'deny_unknown_fields',
    'internally-tagged',
    "studio's own",
    'truecalc/studio',
    'truecalc-wasm-workbook',
    'server-layer concern',
    'reserved wire knob',
    'escape hatch',
    'own precedent',
    'own convention',
    'crate::',
    'leaf file',
    'not modeled here',
    'not enforced',
  ];
  const lower = clause.toLowerCase();
  return phrases.some((p) => lower.includes(p));
}

// Protect abbreviations ("e.g.", "i.e.", "etc.") from being mistaken for a
// sentence end by the period+space sentence splitter below: their periods
// are swapped for a placeholder before splitting, then restored afterward. This
// MUST be a value that cannot occur anywhere in ordinary source text -- a plain
// space is NOT safe: unguardAbbreviations restores it with a blind
// find-and-replace over the whole string, which would turn every space in the
// text into a period, not just the ones this function introduced. U+0000 (NUL)
// qualifies: it can never appear in a JSON string (JSON.parse rejects a raw
// control character there) and JS source never emits it either.
const ABBREV_PLACEHOLDER = '\u0000';

function guardAbbreviations(text) {
  return text.replace(/\b(e\.g|i\.e|etc)\./gi, (m) => m.split('.').join(ABBREV_PLACEHOLDER));
}

function unguardAbbreviations(text) {
  return text.split(ABBREV_PLACEHOLDER).join('.');
}

/**
 * Salvage a plain-English description out of a Rust-doc-comment-style
 * `description` string. Rust doc comments put the summary in the first
 * paragraph and implementation rationale after it, so only the first
 * paragraph is considered. Parenthetical asides are dropped whole when
 * they're jargon, or unwrapped in place when they're a legitimate aside
 * (e.g. "(a single cell)"). What's left is split into sentences, then
 * further into clauses on em dashes/semicolons, and only clauses with no
 * jargon survive -- never a word-level strip that could leave a mangled
 * fragment. Returns null if nothing salvageable survives.
 */
function cleanText(raw) {
  if (!raw) return null;
  const firstParagraph = String(raw).split(/\n\s*\n/, 1)[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (!firstParagraph) return null;

  // Unwrap or drop parenthetical asides. Requires whitespace (or
  // start-of-string) right before the "(" so a paren glued directly onto a
  // preceding token -- e.g. the `(_)` inside a code span like `` `Some(_)` ``
  // -- is left alone rather than torn out of its backticks.
  const withoutParens = firstParagraph.replace(
    /(^|\s)\(([^()]*)\)/g,
    (whole, boundary, inner) => (isJargon(inner) ? '' : `, ${inner}`),
  );
  const guarded = guardAbbreviations(withoutParens);

  const sentences = guarded.split(/(?<=[.!?])\s+/).filter(Boolean);
  const keptSentences = [];
  for (const sentence of sentences) {
    const clauses = sentence.split(/\s+—\s+|\s+--\s+|;\s+/).map((c) => c.trim().replace(/[.,;]+$/, ''));
    const kept = clauses.filter((c) => c.length >= 3 && !isJargon(c));
    if (kept.length > 0) keptSentences.push(`${kept.join(', ')}.`);
  }
  if (keptSentences.length === 0) return null;
  let result = unguardAbbreviations(keptSentences.join(' '))
    .replace(/\s+/g, ' ')
    .replace(/,\s*\./g, '.')
    .replace(/^,\s*/, '')
    .trim();
  if (!result) return null;
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

const VERB_PRESENT = {
  set: 'Sets',
  get: 'Gets',
  insert: 'Inserts',
  remove: 'Removes',
  update: 'Updates',
  delete: 'Deletes',
  clear: 'Clears',
  reorder: 'Reorders',
  merge: 'Merges',
  unmerge: 'Unmerges',
  sort: 'Sorts',
  fill: 'Fills',
  find: 'Finds',
  replace: 'Replaces',
  import: 'Imports',
  export: 'Exports',
  undo: 'Undoes',
  redo: 'Redoes',
  restore: 'Restores',
  add: 'Adds',
  rename: 'Renames',
  autofill: 'Autofills',
  paste: 'Pastes',
};

const CATEGORY_LABEL = {
  chart: 'a chart',
  clipboard: 'the clipboard',
  data: 'sheet data',
  edit: 'cell contents',
  file: 'a workbook file',
  format: 'cell formatting',
  history: "the workbook's edit history",
  read: 'workbook data',
  sheet: 'a sheet',
  structure: 'the grid structure',
  view: 'the page layout',
};

// A handful of wire names whose action word doesn't humanize cleanly as
// "<Verb> the <rest>" (an adverb-shaped tail, or a noun-first name with no
// verb at all). Hand-adjusted grammar only -- still a generic paraphrase of
// the wire name itself, not sourced content.
const SUMMARY_OVERRIDES = {
  'edit:fillDown': 'Fills a range downward from its top row.',
  'edit:fillRight': 'Fills a range rightward from its left column.',
  'edit:findReplace': 'Finds and replaces text within a range.',
  'sheet:setActive': 'Sets the active sheet.',
  'format:textColor': 'Sets the text color of a range.',
  'format:fillColor': 'Sets the background fill color of a range.',
  'format:setBold': 'Turns bold formatting on or off for a range.',
  'format:setItalic': 'Turns italic formatting on or off for a range.',
  'format:setStrike': 'Turns strikethrough formatting on or off for a range.',
  'format:setUnderline': 'Turns underline formatting on or off for a range.',
  'format:setAlign': 'Sets the horizontal text alignment of a range.',
  'format:setValign': 'Sets the vertical text alignment of a range.',
  'format:setWrap': 'Sets the text-wrapping mode of a range.',
  'history:undo': "Undoes the workbook's most recent edit.",
  'history:redo': 'Re-applies the most recently undone edit.',
  'history:restore': 'Restores the workbook to a specific point in its edit history.',
  'clipboard:paste': 'Pastes previously copied or cut cells into a range.',
  'structure:mergeHorizontally': 'Merges each row of a range into one cell, horizontally.',
  'structure:mergeVertically': 'Merges each column of a range into one cell, vertically.',
  'structure:unmergeCells': 'Splits previously merged cells back apart.',
  'data:insertPivot': 'Inserts a pivot table summarizing a range.',
};

/** Derive a short, honest one-line summary purely from the wire name -- the
 * tool-level `description` in this dataset is always boilerplate along the
 * lines of "`edit:setCell`'s wire payload -- ported field-by-field from
 * `EditSetCellSchema`", with no salvageable plain-English summary of what
 * the tool actually does, so this is used unconditionally rather than
 * attempting cleanText() on it first. */
function synthesizeSummary(wireName) {
  if (SUMMARY_OVERRIDES[wireName]) return SUMMARY_OVERRIDES[wireName];
  const [category, action] = wireName.split(':');
  const words = action
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ');
  const verb = VERB_PRESENT[words[0]];
  if (verb) {
    const rest = words.slice(1).join(' ').trim();
    const subject = rest ? `the ${rest}` : (CATEGORY_LABEL[category] ?? category);
    return `${verb} ${subject}.`;
  }
  return `Performs the "${action}" ${CATEGORY_LABEL[category] ?? category} operation.`;
}

// ---------------------------------------------------------------------------
// Structural JSON-Schema -> type-label rendering.
// ---------------------------------------------------------------------------

function resolveRef(node, defs) {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const name = node.$ref.split('/').pop();
    return defs[name] ?? {};
  }
  return node;
}

/** A short, plain-text type label for a schema node. Never contains a `|`
 * (GFM table cells split on an unescaped pipe even inside inline code), and
 * is safe to wrap wholesale in a single pair of backticks for the table
 * cell -- MDX treats inline-code content as inert text, so stray `{`/`}`
 * from an inlined object shape can't be misread as an expression. */
function typeLabel(nodeIn, defs, depth = 0) {
  const node = resolveRef(nodeIn, defs) ?? {};
  const maxDepth = 2;

  if (Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.filter((s) => s.type !== 'null');
    const hasNull = node.anyOf.some((s) => s.type === 'null');
    if (nonNull.length === 1) {
      const inner = typeLabel(nonNull[0], defs, depth);
      return hasNull ? `${inner} or null` : inner;
    }
    return node.anyOf.map((s) => typeLabel(s, defs, depth)).join(' or ');
  }
  if (Array.isArray(node.oneOf)) {
    if (node.oneOf.every((s) => s.const !== undefined)) {
      return node.oneOf.map((s) => JSON.stringify(s.const)).join(', ');
    }
    if (node.oneOf.length === 1) return typeLabel(node.oneOf[0], defs, depth);
    return node.oneOf.map((s) => typeLabel(s, defs, depth)).join(' or ');
  }
  if (Array.isArray(node.enum)) {
    return node.enum.map((v) => JSON.stringify(v)).join(', ');
  }
  if (node.const !== undefined) {
    return JSON.stringify(node.const);
  }
  if (Array.isArray(node.type)) {
    const nonNull = node.type.filter((t) => t !== 'null');
    const hasNull = node.type.includes('null');
    const base = nonNull.join(' or ') || 'any';
    return hasNull ? `${base} or null` : base;
  }
  if (node.type === 'array') {
    return `array of ${node.items ? typeLabel(node.items, defs, depth + 1) : 'any'}`;
  }
  if (node.type === 'object' || (!node.type && node.properties)) {
    if (node.properties && depth < maxDepth) {
      const required = new Set(node.required ?? []);
      const fields = Object.entries(node.properties).map(
        ([key, val]) => `${key}${required.has(key) ? '' : '?'}: ${typeLabel(val, defs, depth + 1)}`,
      );
      // "; " between fields, not ", " -- a field's own type can itself be a
      // comma-joined enum/union (e.g. `"solid", "dashed"`), and ", " at both
      // levels would make the two indistinguishable.
      const inline = `{ ${fields.join('; ')} }`;
      if (fields.length > 0 && inline.length <= 160) return inline;
      // Too long to inline in full. If this object is one branch of a
      // discriminated union (a literal-string `const` field, conventionally
      // named `kind`), keep at least that tag rather than falling all the
      // way to a bare "object" -- when this shows up beside sibling
      // branches in a oneOf/anyOf listing, the tag is exactly what lets a
      // reader tell the branches apart; the full field list is still one
      // click away in the raw JSON Schema below.
      const discriminator = Object.entries(node.properties).find(([, val]) => {
        const resolved = resolveRef(val, defs) ?? {};
        return typeof resolved.const === 'string';
      });
      if (discriminator) {
        const [key, val] = discriminator;
        const resolved = resolveRef(val, defs) ?? {};
        return `{ ${key}: ${JSON.stringify(resolved.const)}, … }`;
      }
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object' && depth < maxDepth) {
      return `{ [key: string]: ${typeLabel(node.additionalProperties, defs, depth + 1)} }`;
    }
    return 'object';
  }
  if (['string', 'number', 'integer', 'boolean', 'null'].includes(node.type)) return node.type;
  return 'any';
}

/** Build a Markdown parameters/fields table from a JSON Schema object's
 * `properties`/`required`, cleaning each property's own description (or,
 * lacking one, its resolved `$ref` def's description). */
function paramsTable(objectSchema, defs) {
  const properties = objectSchema.properties ?? {};
  const names = Object.keys(properties);
  if (names.length === 0) return null;
  const required = new Set(objectSchema.required ?? []);
  const rows = names.map((name) => {
    const prop = properties[name];
    const type = typeLabel(prop, defs);
    const resolved = resolveRef(prop, defs) ?? {};
    let description = cleanText(prop.description) ?? cleanText(resolved.description);
    if (prop.default !== undefined && !/default/i.test(description ?? '')) {
      const defaultNote = `Defaults to \`${JSON.stringify(prop.default)}\`.`;
      description = description ? `${description} ${defaultNote}` : defaultNote;
    }
    return `| \`${name}\` | \`${type}\` | ${required.has(name) ? 'yes' : 'no'} | ${mdxEscape(description ?? '—')} |`;
  });
  return ['| Name | Type | Required | Description |', '| --- | --- | --- | --- |', ...rows].join('\n');
}

/**
 * Deep-clone a JSON Schema node with every `description` string replaced by
 * its cleanText()-salvaged form, or removed entirely when nothing
 * salvageable survives. The raw JSON Schema block on each page (below) dumps
 * `payload`/`output` verbatim, `$defs` included -- without this pass it
 * would leak the exact same Rust-implementation narration (private repo
 * names, crate paths, internal issue IDs, source file paths) that
 * cleanText()/isJargon() exist to keep out of the prose tables above it.
 */
function sanitizeSchemaForDisplay(node) {
  if (Array.isArray(node)) return node.map(sanitizeSchemaForDisplay);
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'description' && typeof value === 'string') {
        const cleaned = cleanText(value);
        if (cleaned) out[key] = cleaned;
        continue; // nothing salvageable -- drop the key rather than leak it
      }
      out[key] = sanitizeSchemaForDisplay(value);
    }
    return out;
  }
  return node;
}

// ---------------------------------------------------------------------------
// Page generation.
// ---------------------------------------------------------------------------

function slugify(wireName) {
  return wireName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/:/g, '-')
    .toLowerCase();
}

function toolPage(wireName, entry) {
  const { payload, output } = entry;
  const description = synthesizeSummary(wireName);

  const lines = [];
  lines.push('---');
  lines.push(`title: ${JSON.stringify(wireName)}`);
  lines.push(`description: ${JSON.stringify(description)}`);
  lines.push('---');
  lines.push('');
  lines.push('{/* GENERATED by scripts/gen-mcp-docs.mjs from scripts/mcp-source/tool-schemas.json — do not edit. */}');
  lines.push('');

  lines.push('## Parameters');
  lines.push('');
  const defs = payload.$defs ?? {};
  const table = paramsTable(payload, defs);
  lines.push(table ?? 'This tool takes no parameters.');
  lines.push('');

  lines.push('## Returns');
  lines.push('');
  const outputIsNull = output?.type === 'null';
  if (outputIsNull) {
    lines.push('Nothing beyond the standard MCP success envelope.');
  } else {
    const outputDefs = output.$defs ?? {};
    const outputTable = paramsTable(output, outputDefs);
    lines.push(outputTable ?? 'An object whose exact shape is shown in the response schema below.');
  }
  lines.push('');

  lines.push('## Schema');
  lines.push('');
  lines.push('Request payload, as JSON Schema:');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(sanitizeSchemaForDisplay(payload), null, 2));
  lines.push('```');
  lines.push('');
  if (!outputIsNull) {
    lines.push('Response payload, as JSON Schema:');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(sanitizeSchemaForDisplay(output), null, 2));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const raw = readFileSync(sourcePath, 'utf8');
  const tools = JSON.parse(raw);
  const wireNames = Object.keys(tools).sort();
  if (wireNames.length === 0) throw new Error(`No tools found in ${sourcePath}`);

  // index.mdx is hand-written (not generated) -- clear only the generated
  // tool pages and meta.json, never the whole directory.
  mkdirSync(outDir, { recursive: true });
  if (existsSync(outDir)) {
    for (const entry of readdirSync(outDir)) {
      if (entry === 'index.mdx') continue;
      if (entry.endsWith('.mdx') || entry === 'meta.json') rmSync(join(outDir, entry));
    }
  }

  const slugs = [];
  for (const wireName of wireNames) {
    const slug = slugify(wireName);
    if (slugs.includes(slug)) throw new Error(`Duplicate MCP tool slug: ${slug}`);
    slugs.push(slug);
    writeFileSync(join(outDir, `${slug}.mdx`), toolPage(wireName, tools[wireName]) + '\n');
  }

  writeFileSync(
    join(outDir, 'meta.json'),
    JSON.stringify({ title: 'MCP', pages: ['index', ...slugs] }, null, 2) + '\n',
  );

  console.log(`gen-mcp-docs: wrote ${wireNames.length} tool page(s) + meta.json to ${outDir}`);
}

main();
