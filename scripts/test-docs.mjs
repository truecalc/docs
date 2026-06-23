#!/usr/bin/env node
/**
 * test-docs: extract marked fenced code blocks from Learn MDX pages and
 * execute them against the pinned @truecalc/core. A failing example fails CI.
 *
 * Supported markers (the word `test` in the fence info string):
 *   ```ts test       — TypeScript/JS module, executed with Node; must throw on
 *                      failure (use node:assert).
 *   ```js test       — same, plain JS.
 *   ```formula test  — one formula per line: `=FORMULA // => expected`,
 *                      evaluated with createEngine('google-sheets') and
 *                      compared to the expected string.
 *
 * Blocks WITHOUT the `test` marker are ignored (illustrative snippets).
 */
import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['learn', 'tutorials', 'comparisons'].map((d) => join(root, 'content', 'docs', d));
const workDir = join(root, '.docs-test');

const NODE_FLAGS = ['--experimental-wasm-modules', '--experimental-strip-types', '--no-warnings'];

function* mdxFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* mdxFiles(p);
    else if (entry.name.endsWith('.mdx')) yield p;
  }
}

function* allMdxFiles() {
  for (const dir of SCAN_DIRS) {
    if (existsSync(dir)) yield* mdxFiles(dir);
  }
}

const FENCE_RE = /^```([^\n`]*)\n([\s\S]*?)^```\s*$/gm;

function extractBlocks(source) {
  const blocks = [];
  for (const m of source.matchAll(FENCE_RE)) {
    const info = m[1].trim().split(/\s+/).filter(Boolean);
    const lang = (info[0] ?? '').toLowerCase();
    if (!info.slice(1).includes('test')) continue;
    const line = source.slice(0, m.index).split('\n').length;
    blocks.push({ lang, code: m[2], line });
  }
  return blocks;
}

function formulaHarness(code) {
  // Compile a `formula test` block into an executable module.
  const cases = [];
  for (const rawLine of code.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const m = line.match(/^(.+?)\s*\/\/\s*=>\s*(.*)$/);
    if (!m) throw new Error(`Malformed formula test line: ${JSON.stringify(line)} (expected \`=FORMULA // => expected\`)`);
    cases.push({ formula: m[1].trim(), expected: m[2].trim() });
  }
  return `
import { createEngine } from '@truecalc/core';
import assert from 'node:assert/strict';

function render(result) {
  switch (result.type) {
    case 'number': return String(result.value);
    case 'text': return result.value;
    case 'bool': return result.value ? 'TRUE' : 'FALSE';
    case 'error': return result.error;
    case 'empty': return '';
    case 'date': return String(result.value);
    case 'zoned': return result.value;
    case 'array':
      if (result.value.length === 1) return render(result.value[0]);
      return result.value.map(render).join('\\n');
    default: throw new Error('Unknown result type: ' + JSON.stringify(result));
  }
}

const engine = createEngine('google-sheets');
const cases = ${JSON.stringify(cases)};
for (const c of cases) {
  const actual = render(engine.evaluate(c.formula, null));
  assert.equal(actual, c.expected, \`\${c.formula} => \${actual}, expected \${c.expected}\`);
}
`;
}

async function main() {
  const { spawnSync } = await import('node:child_process');
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  let total = 0;
  let failed = 0;
  let i = 0;

  for (const file of allMdxFiles()) {
    const rel = relative(root, file);
    for (const block of extractBlocks(readFileSync(file, 'utf8'))) {
      let filename;
      let code;
      if (block.lang === 'ts' || block.lang === 'typescript') {
        filename = `block-${i}.mts`;
        code = block.code;
      } else if (block.lang === 'js' || block.lang === 'javascript') {
        filename = `block-${i}.mjs`;
        code = block.code;
      } else if (block.lang === 'formula') {
        filename = `block-${i}.mjs`;
        code = formulaHarness(block.code);
      } else {
        total += 1;
        failed += 1;
        console.error(`FAIL   ${rel}:${block.line} — unsupported test language \`${block.lang}\``);
        continue;
      }
      i += 1;
      total += 1;
      const path = join(workDir, filename);
      writeFileSync(path, code);
      const res = spawnSync(process.execPath, [...NODE_FLAGS, path], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
      });
      if (res.status === 0) {
        console.log(`PASS   ${rel}:${block.line} (${block.lang})`);
      } else {
        failed += 1;
        console.error(`FAIL   ${rel}:${block.line} (${block.lang})`);
        if (res.stdout) console.error(res.stdout.trimEnd());
        if (res.stderr) console.error(res.stderr.trimEnd());
      }
    }
  }

  rmSync(workDir, { recursive: true, force: true });
  console.log(`test-docs: ${total - failed}/${total} block(s) passed`);
  if (failed > 0) process.exit(1);
  if (total === 0) console.log('test-docs: no test blocks found (placeholders only) — OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
