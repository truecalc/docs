import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      // `formula` fences (spreadsheet formulas) have no Shiki grammar yet —
      // render unknown languages as plain text. `formula test` blocks are
      // executed by scripts/test-docs.mjs.
      fallbackLanguage: 'text',
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
