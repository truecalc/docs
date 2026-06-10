import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema.extend({
      llmsDescription: z.string().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      jsonLdFaq: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .optional(),
      jsonLdHowTo: z
        .array(z.object({ name: z.string(), text: z.string() }))
        .optional(),
    }),
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
    remarkPlugins: [remarkMdxMermaid],
    rehypeCodeOptions: {
      // `formula` fences (spreadsheet formulas) have no Shiki grammar yet —
      // render unknown languages as plain text. `formula test` blocks are
      // executed by scripts/test-docs.mjs.
      fallbackLanguage: 'text',
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
