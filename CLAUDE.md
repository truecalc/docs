# truecalc/docs — Project Memory

Fumadocs (Next.js, static export) documentation site for TrueCalc.
Content lives in `content/docs/` — three root tabs: `learn/`, `reference/`, `api/`.

## Workflow rules (ALWAYS)

- **PR-only.** Never commit to `main` directly. Branch per issue: `feat/<issue>-<desc>`.
- Open PRs with `closes #<issue>`, **assign `@hhimanshu`**, wait for CI green.
- **Never auto-merge.** Merging is always the owner's act.
- **Commit identity (ALWAYS):** author commits as
  `hhimanshu <6589036+hhimanshu@users.noreply.github.com>` — never any other email.
  Set per clone before committing:
  `git config user.name "hhimanshu" && git config user.email "6589036+hhimanshu@users.noreply.github.com"`.

## Content rules

- **Fixture-citation rule (tutorial-writer):** never assert spreadsheet behavior
  ("Google Sheets does X", an expected formula result, an error message) without
  a fixture ID from `truecalc/core` (`crates/core/tests/fixtures/google_sheets/<file>.tsv`
  + the row's description). If no fixture exists, request one from the fixture
  engineer — do not self-confirm values.
- Learn examples: fence code blocks with `ts test`, `js test`, or `formula test`
  to have CI execute them (`npm run test-docs`). A failing example fails the build.
  Formula test lines: `=FORMULA // => expected`.
- `content/docs/reference/functions/` is **generated** by `npm run gen-docs` from
  `functions.json` in `truecalc/core` — never edit by hand; CI fails on drift.

## Version-pin rule

- This repo pins exact TrueCalc package versions (`@truecalc/core`, later
  `@truecalc/workbook`) as devDependencies — no `^`/`~` ranges. All example
  testing and generation run against the pinned version.
- `scripts/gen-docs.mjs` `PINNED_CORE_REF` must point at the core release tag
  matching the pinned package version (currently `main` until `functions.json`
  is populated — truecalc/core#14).
- Every `truecalc/core` release is accompanied by a version-bump PR here.

## Build & checks

- `npm run dev` / `npm run build` (static export to `out/`).
- `npm run test-docs` — execute marked Learn examples.
- `npm run gen-docs` — regenerate function reference; CI drift check is
  `git diff --exit-code -- content/docs/reference/functions`.
- Deploy: GitHub Pages via `.github/workflows/deploy.yml`
  (`NEXT_PUBLIC_BASE_PATH=/docs`).
