# FHIR Validation Markdown Renderer

Parses a FHIR `OperationOutcome` bundle and outputs issues at or above a configurable severity level.

## Usage

```yaml
steps:
  - uses: actions/checkout@v3
  - uses: DeinOrg/fhir-validation-action@v1
    with:
      bundle-file: validation.json
      include: errors   # errors, warnings oder all
