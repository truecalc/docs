'use client';

import { useEffect, useId, useRef } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      mermaid.render(`mermaid-${id.replace(/:/g, '')}`, chart).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    });
  }, [chart, id]);

  return <div ref={ref} style={{ overflowX: 'auto', padding: '0.5rem 0' }} />;
}
