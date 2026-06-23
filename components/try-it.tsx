'use client';

import { useState } from 'react';

type EvalResult =
  | { type: 'number'; value: number }
  | { type: 'text'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'error'; error: string }
  | { type: 'empty' }
  | { type: 'date'; value: number }
  | { type: 'zoned'; value: string }
  | { type: 'array'; value: EvalResult[] };

function renderResult(r: EvalResult): string {
  switch (r.type) {
    case 'number': return String(r.value);
    case 'text': return r.value;
    case 'bool': return r.value ? 'TRUE' : 'FALSE';
    case 'error': return r.error;
    case 'empty': return '(empty)';
    case 'date': return String(r.value);
    case 'zoned': return r.value;
    case 'array':
      if (r.value.length === 1) return renderResult(r.value[0]);
      return r.value.map(renderResult).join('\n');
  }
}

export function TryIt({ formula = '=1+1', label }: { formula?: string; label?: string }) {
  const [input, setInput] = useState(formula);
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!input.trim()) return;
    setBusy(true);
    try {
      const mod = await import('@truecalc/core');
      const engine = mod.createEngine('google-sheets');
      const result = engine.evaluate(input, {}) as EvalResult;
      setOutput(renderResult(result));
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="not-prose my-4 rounded-lg border p-3">
      {label ? <div className="mb-2 text-sm font-medium">{label}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="formula"
          className="flex-1 min-w-[12rem] rounded border bg-transparent px-2 py-1 font-mono text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
        />
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded bg-fd-primary px-3 py-1 text-sm text-fd-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>
      {output !== null ? (
        <div className="mt-2 font-mono text-sm" role="status" aria-live="polite">
          <span className="opacity-60">=&gt; </span>{output}
        </div>
      ) : null}
    </div>
  );
}
