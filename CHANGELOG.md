# Changelog

All notable changes to this action are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries before 1.4.0 were reconstructed from the git history and the GitHub release
notes, so they cover the user-visible changes rather than every commit. Dependency
bumps are omitted throughout.

## [1.5.0] - 2026-08-07

### Changed

- The action runs on the `node24` runtime instead of `node20`, which GitHub has
  deprecated. Workflows keep working unchanged, but the runner has to be new enough to
  provide Node 24: GitHub-hosted runners are, self-hosted runners need runner 2.327.1
  or newer, and GitHub Enterprise Server needs 3.19 or newer. On an older runner the
  step fails to start rather than falling back to Node 20.

## [1.4.0] - 2026-08-07

### Added

- `bundle-file` accepts XML as well as JSON, so the `output/qa.xml` written by the IG
  Publisher can be used directly. The format is detected from the file content (a
  leading `<`), not from the extension, and both a `Bundle` and a standalone
  `OperationOutcome` work in either format. Filters, severities and the summary table
  behave identically for both.
- Malformed XML now fails the action with a parse error instead of being read as
  silently incomplete data.

### Fixed

- Filters whose `location` was copied out of the summary table work again ([#20]).
  The fix in 1.3.0 only covered locations copied from the console: the table still
  rendered invisible zero-width spaces, and a rule built from one could never match,
  with nothing visible to explain why. Break opportunities are now `<wbr>` markup,
  which does not travel with the copied text, and locations are normalized on both
  sides of the comparison. Rules that already carry zero-width spaces from an earlier
  release match again, so existing workflows are repaired rather than broken.

  Note that `v1.3.0-beta.1` announced this issue as fixed; that was premature.

### Changed

- Nothing that affects existing workflows. `action.yml` inputs, their defaults and
  their behaviour are unchanged.

For contributors: CI no longer builds and commits `dist/`. Run `npm ci && npm run
build` and commit the result yourself — CI verifies that the committed bundle matches
`src/` and fails if it is stale. See [CONTRIBUTING.md](CONTRIBUTING.md).

## [1.3.0] - 2026-03-31

### Added

- `detailsWildcard` filters match across line breaks, so a `*` can span the multi-line
  messages the terminology server returns.

### Fixed

- Zero-width spaces are no longer inserted into the location used for annotations and
  filter matching; they are added only when rendering the summary table ([#20], but
  see 1.4.0 — the table itself remained affected).
- The major-version tag is no longer moved by pre-releases.

## [1.2.2] - 2025-12-03

### Fixed

- A standalone `OperationOutcome` is accepted, not just a `Bundle` of them.

## [1.2.1] - 2025-10-14

### Fixed

- The PR summary markdown is written before the summary buffer is flushed, so the file
  is no longer empty.

## [1.2.0] - 2025-10-14

### Added

- `pr-summary-path` writes the summary as a markdown file for use in PR comments.

## [1.1.0] - 2025-09-23

### Added

- Filters that never matched anything are reported as "unused filters" in the log and
  in the summary, to surface stale rules.

## [1.0.1] - 2025-05-08

### Added

- The summary reports original and filtered counts per severity, rather than only what
  remains.

## [1.0.0] - 2025-05-08

First stable release. Renders a Java FHIR Validator `OperationOutcome` as check
annotations and a summary table, with `filename|messageId|detailsWildcard|location`
skip-rules for known issues, and fails the job if any `ERROR` remains after filtering.

## [0.1.0] - 2025-04-24

Initial release.

[#20]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/issues/20
[1.5.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.3.0...v1.4.0
[1.3.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.2.2...1.3.0
[1.2.2]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.2.1...1.2.2
[1.2.1]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.1.0...1.2.0
[1.1.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.0.1...1.1.0
[1.0.1]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/compare/0.3.4...1.0.0
[0.1.0]: https://github.com/patrick-werner/validation-outcome-markdown-renderer/releases/tag/0.1.0
