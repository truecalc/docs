'use client';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from 'fumadocs-ui/components/dialog/search';
import { useDocsSearch } from 'fumadocs-core/search/client';
import { create } from '@orama/orama';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';

function initOrama() {
  return create({
    schema: { _: 'string' },
    // https://docs.orama.com/docs/orama-js/supported-languages
    language: 'english',
  });
}

export default function DefaultSearchDialog(props: SharedProps) {
  const { locale } = useI18n(); // (optional) for i18n
  const { search, setSearch, query } = useDocsSearch({
    type: 'static',
    // respect basePath when deployed under https://truecalc.github.io/docs/
    from: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/search`,
    initOrama,
    locale,
  });

  const lastTrackedQuery = useRef('');
  useEffect(() => {
    if (!query.isLoading && search.trim() && search !== lastTrackedQuery.current) {
      lastTrackedQuery.current = search;
      const results = query.data !== 'empty' ? (query.data?.length ?? 0) : 0;
      posthog.capture('docs_searched', { query: search, results_count: results });
    }
  }, [search, query.isLoading, query.data]);

  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={query.isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data !== 'empty' ? query.data : null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
