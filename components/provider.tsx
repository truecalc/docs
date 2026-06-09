'use client';
import SearchDialog from '@/components/search';
import { RootProvider } from 'fumadocs-ui/provider/next';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { type ReactNode } from 'react';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <RootProvider search={{ SearchDialog }}>{children}</RootProvider>
    </PostHogProvider>
  );
}
