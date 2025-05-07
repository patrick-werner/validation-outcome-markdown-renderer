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
        Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.​code
        |UNKNOWN_CODESYSTEM||Observation.component
```

## Inputs

| Input         | Type   | Required | Default           | Description                                                             |
| ------------- | ------ | -------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundle-file` | string | No       | `validation.json` | Path to the JSON file containing the OperationOutcome bundle            |
| `include`     | string | No       | `errors`          | Which severities to output:<br>- `errors`<br>- `warnings`<br>- `all`    |
| `filters`     | string | No       | (empty)           | Line-separated list of filters in the form `fileName\|messageId\|detailsWildcard\|location`.<br>- `fileName`, `messageId`, and `location` must match exactly.<br>- `detailsWildcard` may use `*` for wildcard matching.<br>- If a field is empty, it is ignored.         |

## Example

```yaml
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: validation.json
    include: warnings
    filters: |
      Observation-Linksatrialer-Druck.json|VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*|Observation.​code
      |UNKNOWN_CODESYSTEM||Observation.component
```

In this example, issues at degree **warning** or higher will be reported, **except** those matching either filter:  
- those in `Observation-Linksatrialer-Druck.json` with `messageId` `VALIDATION_VAL_PROFILE_MINIMUM`, details containing “magic LOINC code”, and location `Observation.code`, or  
- any file with `messageId` `UNKNOWN_CODESYSTEM` and location `Observation.component` (details ignored for this filter).
