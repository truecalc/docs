'use strict';
/**
 * yaml-lite: a tiny, TOTAL parser for the restricted YAML subset that the
 * enrichment files use. NOT a general YAML parser — it deliberately supports
 * only the exact shapes documented in `enrichment/_schema.md`:
 *
 *   - Top-level `key: <scalar>`          (e.g. a bare or "double-quoted" string)
 *   - Top-level `key: [a, b, c]`         (inline array → string[])
 *   - Top-level `key:` followed by a block list of items, where each item is a
 *     flat map spanning one or more lines:
 *         - q: "..."
 *           a: "..."
 *         - title: "..."
 *           formula: "..."
 *           industries: [a, b]
 *
 * Anything outside this subset THROWS a clear Error. The caller (the enrichment
 * linter) treats a thrown error as a lint failure, so silent guessing is wrong.
 *
 * Blank lines and `#` comments are ignored.
 *
 * Exports: module.exports = { load }  where load(text) -> plain object.
 */

function stripComment(line) {
  // Remove a trailing `#` comment, but not inside quotes. The subset never puts
  // `#` inside an unquoted scalar, so a quote-aware scan is sufficient.
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inDouble = !inDouble;
    else if (ch === '#' && !inDouble) {
      // Only treat as a comment if preceded by start-of-line or whitespace.
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function indentOf(line) {
  const m = /^( *)/.exec(line);
  return m[1].length;
}

function parseScalar(raw, lineNo) {
  const v = raw.trim();
  if (v.length === 0) {
    throw new Error(`line ${lineNo}: empty scalar value`);
  }
  if (v[0] === '"') {
    if (v.length < 2 || v[v.length - 1] !== '"') {
      throw new Error(`line ${lineNo}: unterminated double-quoted string: ${raw}`);
    }
    return v.slice(1, -1);
  }
  if (v[0] === '[') {
    throw new Error(`line ${lineNo}: inline array not allowed here: ${raw}`);
  }
  return v;
}

function parseInlineArray(raw, lineNo) {
  const v = raw.trim();
  if (v[0] !== '[' || v[v.length - 1] !== ']') {
    throw new Error(`line ${lineNo}: malformed inline array: ${raw}`);
  }
  const inner = v.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((item) => {
    let s = item.trim();
    if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
      s = s.slice(1, -1);
    }
    if (s === '') {
      throw new Error(`line ${lineNo}: empty item in inline array: ${raw}`);
    }
    return s;
  });
}

// Parse `key: value` (value may be empty for a block-list header).
function splitKeyValue(content, lineNo) {
  const idx = content.indexOf(':');
  if (idx === -1) {
    throw new Error(`line ${lineNo}: expected "key: value", got: ${content}`);
  }
  const key = content.slice(0, idx).trim();
  const value = content.slice(idx + 1).trim();
  if (key === '') {
    throw new Error(`line ${lineNo}: empty key in: ${content}`);
  }
  if (/\s/.test(key)) {
    throw new Error(`line ${lineNo}: unexpected whitespace in key "${key}"`);
  }
  return { key, value };
}

// Assign a `key: value` pair into target, interpreting the value form.
function assignField(target, key, value, lineNo) {
  if (value === '') {
    throw new Error(`line ${lineNo}: expected a value for "${key}" (nested blocks unsupported)`);
  }
  if (value[0] === '[') {
    target[key] = parseInlineArray(value, lineNo);
  } else {
    target[key] = parseScalar(value, lineNo);
  }
}

function load(text) {
  if (typeof text !== 'string') {
    throw new Error('yaml-lite: load() expects a string');
  }

  // Pre-process: keep original line numbers for error messages.
  const rawLines = text.split('\n');
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const stripped = stripComment(rawLines[i]);
    if (stripped.trim() === '') continue; // blank or comment-only
    lines.push({ no: i + 1, text: stripped.replace(/\s+$/, '') });
  }

  const result = {};
  let i = 0;

  while (i < lines.length) {
    const { no, text: line } = lines[i];
    const indent = indentOf(line);
    if (indent !== 0) {
      throw new Error(`line ${no}: unexpected indentation at top level: ${line}`);
    }
    if (line.trimStart().startsWith('- ')) {
      throw new Error(`line ${no}: list item without a parent key: ${line}`);
    }

    const { key, value } = splitKeyValue(line.trim(), no);
    i++;

    if (value !== '') {
      // Inline scalar or inline array on the same line.
      if (value[0] === '[') {
        result[key] = parseInlineArray(value, no);
      } else {
        result[key] = parseScalar(value, no);
      }
      continue;
    }

    // Block list expected: subsequent indented `- ...` items.
    const items = [];
    while (i < lines.length) {
      const { no: ino, text: iline } = lines[i];
      const iindent = indentOf(iline);
      if (iindent === 0) break; // next top-level key
      const trimmed = iline.trimStart();
      if (!trimmed.startsWith('- ')) {
        throw new Error(`line ${ino}: expected a list item ("- key: value") under "${key}", got: ${iline}`);
      }
      const itemIndent = iindent;
      // First line of the item: `- key: value`
      const firstContent = trimmed.slice(2).trim();
      const item = {};
      const first = splitKeyValue(firstContent, ino);
      assignField(item, first.key, first.value, ino);
      i++;
      // Continuation lines: indented MORE than the dash, same map.
      while (i < lines.length) {
        const { no: cno, text: cline } = lines[i];
        const cindent = indentOf(cline);
        if (cindent <= itemIndent) break; // end of this item (new item or new key)
        const ctrim = cline.trimStart();
        if (ctrim.startsWith('- ')) {
          throw new Error(`line ${cno}: nested list not supported under "${key}": ${cline}`);
        }
        const kv = splitKeyValue(ctrim, cno);
        assignField(item, kv.key, kv.value, cno);
        i++;
      }
      items.push(item);
    }

    if (items.length === 0) {
      throw new Error(`line ${no}: key "${key}" has no value and no block list following it`);
    }
    result[key] = items;
  }

  return result;
}

module.exports = { load };
