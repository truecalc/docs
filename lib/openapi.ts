import { createOpenAPI } from 'fumadocs-openapi/server';

/**
 * Server instance over the vendored OpenAPI document (openapi/rest-api.json).
 * See openapi/README.md for what "vendored" means here and how to refresh it.
 *
 * The input path is relative to the process cwd (repo root), which is stable
 * both when `scripts/gen-openapi-docs.mjs` runs (`node scripts/...`) and when
 * Next.js renders generated pages at build time — both run from the repo root.
 */
export const openapi = createOpenAPI({
  input: ['./openapi/rest-api.json'],
});
