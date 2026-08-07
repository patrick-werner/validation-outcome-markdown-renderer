# FHIR Validation Markdown Renderer

Parses the `OperationOutcome` bundle produced by the Java FHIR Validator — in JSON or XML — emits GitHub check annotations (❌, ⚠️, ℹ️) for issues at or above the configured severity, supports optional filtering out known issues by specifying combinations of **filename**, **messageId**, **details** (with wildcard), and **location**, and generates a summary Markdown table with issue counts and columns (File, Severity, Details, Location, Code, MessageId) in the GitHub Checks UI.

## Usage

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: patrick-werner/validation-outcome-markdown-renderer@v1
    with:
      bundle-file: validation.json    # Path to your OperationOutcome file (JSON or XML)
      include: errors                 # errors, warnings, or all
      filters: |                      # optional: line-separated filters to skip known issues
        # full-line comments beginning with "#" are ignored
        Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.code
        # you can also omit fields by leaving them empty between pipes
        |UNKNOWN_CODESYSTEM||Observation.component  # messageId + location only
```

## Inputs

| Input            | Type   | Required | Default           | Description                                                             |
| ---------------- | ------ | -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle-file`    | string | No       | `validation.json` | Path to the file containing the OperationOutcome bundle. JSON and XML are both supported; the format is detected from the file content, not the extension. |
| `include`        | string | No       | `errors`          | Which severities to report:<br>- `errors`: only `error`<br>- `warnings`: `error` + `warning`<br>- `all`: `error` + `warning` + `information`             |
| `filters`        | string | No       | _(empty)_         | Line-separated list of skip-filters. See "Filter format" below. |
| `pr-summary-path`| string | No       | `pr-summary.md`   | Path to write the validation summary as a markdown file for PR comments. |

### Filter format

Each non-empty line represents one skip-rule in the form:

```
filename | messageId | detailsWildcard | location
```

Rules
- Fields are separated by `|` and trimmed.
- Leave a field empty to ignore it (i.e., match anything for that position).
- `detailsWildcard` and `location` support `*` as a wildcard (case-insensitive).
- `filename` and `messageId` are matched exactly (case-insensitive for `messageId`).
- Lines and inline fragments starting with `#` are treated as comments and ignored.

Examples

```
# Skip a specific messageId with a details pattern in a single file and location
Observation-Linksatrialer-Druck.json | VALIDATION_VAL_PROFILE_MINIMUM | *magic LOINC code* | Observation.code

# Skip any UNKNOWN_CODESYSTEM at a given location regardless of file/details
| UNKNOWN_CODESYSTEM | | Observation.component
```

## Input formats

Both serializations of the validator output are accepted, and behave identically —
filters, severities and the summary table work the same either way:

```yaml
# JSON (default)
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: validation.json

# XML, e.g. the qa.xml produced by the IG Publisher
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: output/qa.xml
```

A `Bundle` of `OperationOutcome` resources and a standalone `OperationOutcome` are
supported in both formats. XML is detected by its leading `<`, so a file whose
extension does not match its content is still read correctly.

## Examples

### Basic

Skip all "magic LOINC code" errors in a specific file:

```yaml
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: validation.json
    include: errors
    filters: |
      Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.code
```

### Multiple filters & comments

```yaml
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: validation.json
    include: warnings
    filters: |
      # skip known Java‐validator bugs:
      Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.code
      Observation-Rechtsatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM_MAGIC|*magic LOINC code*|Observation.code
      # skip any UNKNOWN_CODESYSTEM warnings in any file/location:
      |UNKNOWN_CODESYSTEM||Observation.component
```

## Output

- **Annotations** in the console via `core.error()`, `core.warning()`, `core.info()`.
- **Filter diagnostics**: any defined filters that never matched are listed in the logs and in the summary (under “Unused filters”) to highlight stale rules.
- **Summary** in the Checks tab:

  ```
  FHIR Validation Results (filter: errors):
    ❌ 3 errors (–5 filtered), ⚠️ 0 warnings filtered, ℹ️ 2 hints filtered — 2025-05-08T12:34:56Z

  | File                                 | Severity       | Details                                | Location         | Code       | MessageId                          |
  |--------------------------------------|----------------|----------------------------------------|------------------|------------|------------------------------------|
  | Observation-Linksatrialer-Druck.json | ❌ ERROR       | …                                      | Observation.code | structure  | VALIDATION_VAL_PROFILE_MINIMUM    |
  | …                                    | …              | …                                      | …                | …          | …                                  |
  ```

- **Exit code**  
  - Fails if any `ERROR` remains after filtering.  
  - Otherwise succeeds.
