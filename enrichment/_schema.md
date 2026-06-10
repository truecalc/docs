# Enrichment file contract

One file per function: `enrichment/<FUNCTION_NAME>.yaml`. Curated content that `gen-docs`
merges into the generated function page. Required/optional fields:

- `when_to_use` (optional): list of `{ q: string, a: string }` — becomes question-headed
  sections + jsonLdFaq.
- `use_cases` (optional): list of `{ title: string, formula: string, industries: string[] }`.
  Every `formula` is CI-executed against pinned core.
- `industries` (optional): string[] from the known tag set (see KNOWN_INDUSTRIES below).
- `related` (optional): string[] of other function names.

KNOWN_INDUSTRIES: finance, lending, real-estate, personal-finance, operations, sales,
education, science, engineering, retail, hr.
