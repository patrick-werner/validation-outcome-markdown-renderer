# CLAUDE.md

GitHub Action that renders Java FHIR Validator `OperationOutcome` output as check
annotations and a summary table, with filters for known issues.

## Layout

- `src/index.js` — the action: reads inputs, filters issues, writes the Checks summary
  and the PR-comment markdown. Fails the job if any `ERROR` remains after filtering.
- `src/parse.js` — reads the outcome file. JSON and XML both produce the *same* plain
  JSON structure, so `index.js` never has to know which format it got.
- `src/filter.js` — `filename|messageId|detailsWildcard|location` skip-rules.
  Filters are mutated with `matched = true` when they fire; unmatched ones are
  reported as "unused filters". Locations are normalized on *both* sides before
  matching: users copy them out of the rendered summary, so a rule can pick up
  rendering artefacts. Never let a display concern reach the matched string —
  that was #20, where invisible zero-width spaces made filters fail with no
  visible cause. The table uses `<wbr>`, which is markup rather than a character
  and so never lands in the clipboard.
- `dist/index.js` — **committed build output**, this is what GitHub actually runs.

## Working on this

```bash
npm ci             # install from the lockfile
npm test           # jest
npm run build      # ncc → dist/index.js
```

- **Always `npm run build` after changing `src/`, and commit `dist/`.** A source change
  without a rebuilt `dist/` has no effect on the released action. CI does *not* build
  `dist/` for you — it rebuilds and fails if the committed output differs from `src/`.
  The ncc build is reproducible, so that check is meaningful only when you install with
  `npm ci`; `npm install` may resolve different versions and produce a differing bundle.
- Run the action locally by passing inputs as env vars. Note the dashes — zsh needs
  `env`, since `INPUT_BUNDLE-FILE=…` is not a valid inline assignment:

  ```bash
  env "INPUT_BUNDLE-FILE=validation.json" INPUT_INCLUDE=all \
      "INPUT_PR-SUMMARY-PATH=/tmp/pr.md" "GITHUB_STEP_SUMMARY=/tmp/sum.md" \
      node src/index.js
  ```

- Inputs are a public contract — keep `action.yml`, the README table and the code in
  sync, and keep changes backwards compatible for existing workflows.
- Releasing is a documented sequence (bump `package.json` → tag `vX.Y.Z` → publish the
  release, which moves `v1`); see "Releasing" in `CONTRIBUTING.md` before tagging.

## FHIR XML → JSON mapping (`src/parse.js`)

The XML path exists because the IG Publisher writes `output/qa.xml`. It reproduces the
official FHIR XML↔JSON mapping for the parts this action reads:

- `<severity value="error"/>` → `severity: "error"` (the `value` attribute *is* the
  primitive value).
- `value…Integer/Decimal/PositiveInt/UnsignedInt` attributes are converted to numbers,
  `valueBoolean` to a boolean; everything else stays a string.
- Elements that are arrays in JSON (`entry`, `issue`, `extension`, `expression`, …)
  must be forced to arrays even when they occur once — see `ARRAY_ELEMENTS`. Add to
  that set if a newly-read field can repeat.
- `<resource><OperationOutcome>…` → `resource: { resourceType: "OperationOutcome", … }`.
  A single upper-case key means a resource type, since FHIR element names are
  lowerCamelCase.
- fast-xml-parser is lenient, so `XMLValidator` runs first — otherwise malformed XML
  parses into silently wrong data instead of failing.

Format detection is by content (leading `<`), not by file extension.
