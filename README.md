# FHIR Validation Markdown Renderer

Parses the JSON `OperationOutcome` bundle produced by the Java FHIR Validator, emits GitHub check annotations (❌, ⚠️, ℹ️) for issues at or above the configured severity, supports optional filtering by `messageId` and wildcard patterns on the details text, and generates a summary Markdown table with issue counts and columns (File, Severity, Details, Location, Code, MessageId) in the GitHub Checks UI.

## Usage

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: patrick-werner/validation-outcome-markdown-renderer@v1
    with:
      bundle-file: validation.json    # Path to your OperationOutcome JSON file
      include: errors                 # errors, warnings, or all
      filters: |                      # optional: line-separated filters
        VALIDATION_VAL_PROFILE_MINIMUM|*magic LOINC code*
        UNKNOWN_CODESYSTEM|*timeout*
```

## Inputs

| Input         | Type   | Required | Default           | Description                                                             |
| ------------- | ------ | -------- | ----------------- | ----------------------------------------------------------------------- |
| `bundle-file` | string | No       | `validation.json` | Path to the JSON file containing the OperationOutcome bundle            |
| `include`     | string | No       | `errors`          | Which severities to output:<br>- `errors`<br>- `warnings`<br>- `all`    |
| `filters`     | string | No       | (empty)           | Line-separated list of filters in the form `messageId\|detailsWildcard`. If one side is empty, it is ignored. |

## Example

```yaml
- uses: patrick-werner/validation-outcome-markdown-renderer@v1
  with:
    bundle-file: validation.json
    include: warnings
    filters: |
      UNKNOWN_CODESYSTEM|
      |*timeout*
```

This example outputs all issues with severity ≥ `warning`, but only if  
**either** the `messageId` equals `UNKNOWN_CODESYSTEM`  
**or** the details text contains the word "timeout".