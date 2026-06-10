'use client';

import { useEffect, useState } from 'react';

interface BenchmarkEntry {
  name: string;
  mean_ns: number;
  stddev_ns: number;
  vs_baseline_pct: number | null;
}

interface PerfSummary {
  baseline_recorded_at: string;
  benchmarks: BenchmarkEntry[];
}

function fmtNs(ns: number): string {
  if (ns >= 1_000_000_000) return `${(ns / 1_000_000_000).toFixed(2)} s`;
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(1)} µs`;
  return `${ns} ns`;
}

export function PerfTable() {
  const [data, setData] = useState<PerfSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://truecalc.github.io/core/perf-summary.json')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json() as Promise<PerfSummary>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-fd-muted-foreground)' }}>
        Loading performance data…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-fd-muted-foreground)' }}>
        Could not load live performance data.{' '}
        <a
          href="https://truecalc.github.io/core/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline' }}
        >
          View CI runs
        </a>{' '}
        instead.
      </div>
    );
  }

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-fd-border)' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Benchmark</th>
            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Mean</th>
            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>± stddev</th>
            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>vs baseline</th>
          </tr>
        </thead>
        <tbody>
          {data.benchmarks.map((row) => {
            const pct = row.vs_baseline_pct;
            const regressed = pct !== null && pct > 10;
            const improved = pct !== null && pct < -5;
            return (
              <tr
                key={row.name}
                style={{ borderBottom: '1px solid var(--color-fd-border)' }}
              >
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}>
                  {row.name}
                </td>
                <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtNs(row.mean_ns)}
                </td>
                <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', color: 'var(--color-fd-muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
                  ±{fmtNs(row.stddev_ns)}
                </td>
                <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: regressed ? 600 : undefined }}>
                  {pct === null ? (
                    <span style={{ color: 'var(--color-fd-muted-foreground)' }}>—</span>
                  ) : (
                    <span style={{ color: regressed ? '#ef4444' : improved ? '#22c55e' : 'var(--color-fd-foreground)' }}>
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-fd-muted-foreground)' }}>
        Baseline recorded: {data.baseline_recorded_at} · Measured on GitHub Actions ubuntu-latest
      </p>
    </div>
  );
}
