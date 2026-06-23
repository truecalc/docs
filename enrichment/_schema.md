# Enrichment file contract

One file per function: `enrichment/<FUNCTION_NAME>.yaml`. Curated content that `gen-docs`
merges into the generated function page. Required/optional fields:

- `when_to_use` (optional): list of `{ q: string, a: string }` — becomes question-headed
  sections + jsonLdFaq.
- `use_cases` (optional): list of `{ title: string, formula: string, industries: string[] }`.
  Every `formula` is CI-executed against pinned core.
- `industries` (optional): string[] from the known tag set (see KNOWN_INDUSTRIES below).
- `related` (optional): string[] of other function names.
- `llms_description` (optional): a single string (≤250 chars) used as the `llmsDescription`
  frontmatter field, which is served in `/llms.txt` and per-page `/llms.mdx/…` routes for
  GEO (generative engine optimisation). When absent, gen-docs auto-generates a template
  string from the function description. Write a practical, query-answering sentence that
  helps an LLM answer "how do I do X with TrueCalc?" — include what the function returns,
  what you pass it, and what related functions it composes with.

KNOWN_INDUSTRIES: finance, lending, real-estate, personal-finance, operations, sales,
education, science, engineering, retail, hr.

## Authoring gotchas (the YAML parser is a tiny restricted subset)

- **Inner quotes are bare, not escaped.** `scripts/yaml-lite.cjs` takes the first and last
  `"` on a value as the delimiters and returns the inner text verbatim — it does NO escape
  processing. So write `formula: "=IF(5 > 3, "yes", "no")"` (bare inner quotes), NOT `\"`.
  A `\"` would put a literal backslash into the formula and make it error at lint time.
- **Every `use_cases[].formula` must be self-contained AND runnable** — no cell refs (`A1`),
  no sheet refs (`Sheet1!`), no `INDIRECT`. Use literals and inline arrays. `npm run
  lint:enrichment` executes them all and fails on any error.
- **Inline arrays:** `,` separates columns, `;` separates rows. A few functions are picky:
  `AVERAGE` wants a horizontal `{1,2,3}` (rejects vertical `{1;2;3}`), while `SUM`/`INDEX`
  accept either. When in doubt, run `lint:enrichment`.
