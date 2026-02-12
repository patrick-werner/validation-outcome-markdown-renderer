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
   npm install
   ```

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
│   └── filter.js         # Filter matching logic
├── __tests__/
│   └── filter.test.js    # Jest tests
├── dist/
│   └── index.js          # Compiled bundle (committed to repo)
├── action.yml            # Action metadata
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

The CI workflow will automatically:
- Run tests
- Build `dist/index.js`
- Commit the build output

But it's good practice to build locally first:

```bash
git add src/ __tests__/ dist/
git commit -m "feat: your feature description"
```

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

## Questions?

Feel free to open an issue for any questions or discussions!
