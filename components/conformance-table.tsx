'use client';

import { useEffect, useState } from 'react';

interface CategoryEntry {
  category: string;
  passed: number;
  total: number;
  blocking: boolean;
}

interface ConformanceSummary {
  version: string;
  generated: string;
  categories: CategoryEntry[];
}

export function ConformanceTable() {
  const [data, setData] = useState<ConformanceSummary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://truecalc.github.io/core/conformance-summary.json')
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json() as Promise<ConformanceSummary>;
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
        Loading conformance data…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-fd-muted-foreground)' }}>
        Could not load live conformance data.{' '}
        <a
          href="https://truecalc.github.io/core/#conformance"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline' }}
        >
          View full conformance report
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
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Category</th>
            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Passed</th>
            <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>Total</th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', minWidth: '120px' }}>Coverage</th>
            <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.categories.map((row) => {
            const pct = row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0;
            return (
              <tr
                key={row.category}
                style={{ borderBottom: '1px solid var(--color-fd-border)' }}
              >
                <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font-mono, monospace)' }}>
                  {row.category}
                </td>
                <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>{row.passed}</td>
                <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem' }}>{row.total}</td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  <div
                    style={{
                      background: 'var(--color-fd-muted)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      height: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: '#22c55e',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-fd-muted-foreground)' }}>
                    {pct}%
                  </span>
                </td>
                <td style={{ padding: '0.5rem 0.75rem' }}>
                  {row.blocking ? (
                    <span style={{ color: '#22c55e', fontWeight: 500 }}>✓ blocking</span>
                  ) : (
                    <span style={{ color: '#eab308', fontWeight: 500 }}>report-only</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-fd-muted-foreground)' }}>
        Last updated: {data.generated} &nbsp;·&nbsp; Version: {data.version}
      </p>
    </div>
  );
}
