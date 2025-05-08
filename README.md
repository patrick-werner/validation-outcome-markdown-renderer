# FHIR Validation Markdown Renderer

Parses the JSON `OperationOutcome` bundle produced by the Java FHIR Validator, emits GitHub check annotations (❌, ⚠️, ℹ️) for issues at or above the configured severity, supports optional filtering out known issues by specifying combinations of **filename**, **messageId**, **details** (with wildcard), and **location**, and generates a summary Markdown table with issue counts and columns (File, Severity, Details, Location, Code, MessageId) in the GitHub Checks UI.

## Usage

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: patrick-werner/validation-outcome-markdown-renderer@v1
    with:
      bundle-file: validation.json    # Path to your OperationOutcome JSON file
      include: errors                 # errors, warnings, or all
      filters: |                      # optional: line-separated filters to skip known issues
        # full-line comments beginning with "#" are ignored
        Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.code
        # you can also omit fields by leaving them empty between pipes
        |UNKNOWN_CODESYSTEM||Observation.component  # messageId + location only
```

## Inputs

| Input         | Type   | Required | Default           | Description                                                             |
| ------------- | ------ | -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle-file` | string | No       | `validation.json` | Path to the JSON file containing the OperationOutcome bundle.                                                                                        |
| `include`     | string | No       | `errors`          | Which severities to report:<br>- `errors`: only `error`<br>- `warnings`: `error` + `warning`<br>- `all`: `error` + `warning` + `information`             |
| `filters`     | string | No       | _(empty)_         | Line-separated list of skip-filters in the form:<br>`filename | messageId | detailsWildcard | location`<br>- **filename**, **messageId**, **location** must match exactly<br>- **detailsWildcard** may use `*` for wildcard matching<br>- Leave a field empty to ignore it<br>- Lines or inline fragments starting with `#` are ignored |

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
