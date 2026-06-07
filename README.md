# TrueCalc Docs

Documentation site for [TrueCalc](https://github.com/truecalc/core) — built with
[Fumadocs](https://fumadocs.dev/) (Next.js, static export), deployed to GitHub Pages.

## Layout

- `content/docs/learn/` — the **Learn** tab: beginner→advanced guide, written
  phase-by-phase alongside the code. Marked code examples are executed in CI.
- `content/docs/reference/` — the **Reference** tab: function pages (generated
  from `functions.json` in `truecalc/core`), error codes, dialects, workbook schema.
- `content/docs/api/` — the **API** tab: MCP tools and the hosted REST API.

## Commands

```bash
npm ci             # install (pins @truecalc/core exactly)
npm run dev        # local dev server
npm run build      # static export to out/
npm run test-docs  # execute marked Learn examples against @truecalc/core
npm run gen-docs   # regenerate content/docs/reference/functions/
```

CI (`.github/workflows/ci.yml`) runs gen-docs drift check, test-docs, and the
build on every PR. Deploys to GitHub Pages happen from `main`
(`.github/workflows/deploy.yml`).

See `CLAUDE.md` for contribution rules (PR-only, fixture-citation rule,
version pinning).
