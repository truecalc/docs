'use client';

import { useEffect, useId, useRef } from 'react';

export function Mermaid({ code }: { code: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      mermaid.render(`mermaid-${id.replace(/:/g, '')}`, code).then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      });
    });
  }, [code, id]);

  return <div ref={ref} style={{ overflowX: 'auto', padding: '0.5rem 0' }} />;
}
