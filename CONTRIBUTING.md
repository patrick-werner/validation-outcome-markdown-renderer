# Contributing to FHIR Validation Markdown Renderer

Thank you for your interest in contributing! 🎉

## Development Setup

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/patrick-werner/validation-outcome-markdown-renderer.git
   cd validation-outcome-markdown-renderer
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```
   Use `npm ci`, not `npm install`: the `dist/` check compares your build against the
   committed bundle, which is only meaningful when both resolve the same dependencies.

3. **Run tests**
   ```bash
   npm test
   ```

4. **Build the action**
   ```bash
   npm run build
   ```
   This compiles `src/index.js` into `dist/index.js` using [@vercel/ncc](https://github.com/vercel/ncc).

## Project Structure

```
├── src/
│   ├── index.js          # Main action logic
│   ├── parse.js          # Reads the outcome file (JSON or XML)
│   └── filter.js         # Filter matching logic
├── __tests__/
│   ├── filter.test.js    # Jest tests
│   └── parse.test.js
├── dist/
│   └── index.js          # Compiled bundle (committed to repo)
├── action.yml            # Action metadata
├── CHANGELOG.md
└── package.json
```

## Making Changes

### 1. Write Tests First

Add tests to `__tests__/` for your changes:

```javascript
test('your new feature', () => {
  // arrange
  // act
  // assert
});
```

### 2. Implement Your Changes

Edit files in `src/`:
- **`src/index.js`**: Main action logic, GitHub annotations, summary generation
- **`src/parse.js`**: Reads the OperationOutcome file; JSON and XML produce the same structure
- **`src/filter.js`**: Filter matching and wildcard logic

### 3. Run Tests

```bash
npm test
```

For coverage report:
```bash
npm test -- --coverage
```

### 4. Build the Distribution

**Important**: Always rebuild before committing!

```bash
npm run build
```

This updates `dist/index.js` which GitHub Actions actually executes.

### 5. Test Locally (Optional)

You can test the action locally using [act](https://github.com/nektos/act) or by creating a test workflow in a separate repository.

### 6. Commit Your Changes

**You must commit `dist/` yourself.** CI does not build it for you — it rebuilds and
verifies that the committed `dist/` matches `src/`, and fails if it is stale:

```bash
npm ci && npm run build
git add src/ __tests__/ dist/
git commit -m "feat: your feature description"
```

If the "Verify dist/ is up to date" check fails, run those two commands and commit
the result. Use `npm ci` rather than `npm install` so the build matches the lockfile.

## Code Style

- Use 2 spaces for indentation
- Follow existing code conventions
- Add comments for complex logic
- Keep functions small and focused

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the guidelines above
4. Push to your fork (`git push origin feature/amazing-feature`)
5. Open a Pull Request with a clear description

## Testing Your Changes in a Workflow

Create a test workflow in your fork or another repo:

```yaml
name: Test Action
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Test your fork/branch
      - uses: your-username/validation-outcome-markdown-renderer@your-branch
        with:
          bundle-file: test-data/validation.json
          include: all
```

## Releasing (maintainers)

Consumers pin either an exact version (`@v1.4.0`) or the floating major tag (`@v1`),
so a release is what actually ships code to them.

1. Move the release's section in [CHANGELOG.md](CHANGELOG.md) from `unreleased` to
   today's date, and add its compare link at the bottom of the file.

2. Bump `version` in `package.json` and refresh the lockfile:

   ```bash
   npm version 1.4.0 --no-git-tag-version
   npm ci && npm run build   # dist/ must match src/ at the released commit
   git commit -am "chore: release 1.4.0"
   ```

3. Tag it **with a leading `v`** and push:

   ```bash
   git tag v1.4.0
   git push origin main v1.4.0
   ```

   Older tags in this repo are inconsistent (`1.3.0` and `v1.2.2` both exist), which
   means `@v1.3.0` does not resolve for anyone who follows the usual Action
   convention. Use `vX.Y.Z` from now on so pinning behaves predictably.

4. Publish a GitHub Release for that tag. Point the notes at the changelog entry
   rather than relying on the generated commit list, which is mostly dependency bumps:

   ```bash
   gh release create v1.4.0 --notes-file <(sed -n '/## \[1.4.0\]/,/^## \[1.3.0\]/p' CHANGELOG.md | sed '$d')
   ```

CI enforces the parts that are easy to get wrong:

- pushing the tag runs the tests and fails if `dist/` is stale or if the tag does not
  match `package.json`;
- publishing the release re-runs those checks before the `v1` tag is moved, and
  refuses to move it to a commit that is not a descendant of where it points now
  (so a backport released after a newer version cannot silently downgrade `@v1`).

Pre-releases (`v1.4.0-beta.1`, marked as pre-release on GitHub) are verified but never
move the major tag.

## Questions?

Feel free to open an issue for any questions or discussions!
