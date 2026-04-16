# Contributing to fxPanel

Thanks for your interest in contributing! This guide covers everything you need to get started.

> **Before starting any significant PR**, please join the [Discord](https://discord.gg/6FcqBYwxH5) and discuss your idea first.

## Getting Started

### Prerequisites

- **Windows** (the builder doesn't support other OSs)
- **Node.js** v22.9 or newer
- **FXServer** installation

### Setup

1. Clone the repository:

```sh
git clone https://github.com/SomeAussieGaymer/fxPanel
cd fxPanel
```

2. Install dependencies and prepare git hooks:

```sh
npm install
npm run prepare
```

3. Create a `.env` file in the project root with your FXServer path:

```sh
TXDEV_FXSERVER_PATH='E:/FiveM/10309/'
```

### Development Workflows

**Core + Panel + Resource** (two terminals):

```sh
# Terminal 1: Start the panel dev server
cd panel
npm run dev

# Terminal 2: Start the core builder (watches files, restarts FXServer)
cd core
npm run dev
```

**NUI Menu**:

```sh
cd nui

# Game dev mode (requires monitor resource restart):
npm run dev

# Browser dev mode:
npm run browser
```

See [development.md](development.md) for the full development guide.

## Coding Style

### TypeScript / JavaScript

- **Formatter**: Prettier — 4-space indent, single quotes, 120-char width, trailing commas
- **Linter**: ESLint 9 flat config with `@typescript-eslint/recommended`
- Prefer **arrow functions** except for React components
- Prefer **implicit return types** over explicit annotations
- Prefer **`for...of`** over `.forEach()`
- Prefer **single quotes** over double quotes
- Use `import` / `export` (ESM) — the project uses `"type": "module"`

### Lua

- **Formatter**: StyLua — 4-space indent
- Follow existing patterns in `resource/`

### Formatting

Run Prettier before committing:

```sh
npm run format
```

Or check without modifying:

```sh
npm run format:check
```

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by Commitlint.

### Format

```
type(scope): description
```

### Allowed Types

| Type       | Use for                                 |
| ---------- | --------------------------------------- |
| `feat`     | New features                            |
| `fix`      | Bug fixes                               |
| `docs`     | Documentation changes                   |
| `style`    | Formatting, whitespace (no code change) |
| `refactor` | Code restructuring (no feature/fix)     |
| `perf`     | Performance improvements                |
| `test`     | Adding or updating tests                |
| `build`    | Build system or dependency changes      |
| `ci`       | CI/CD configuration                     |
| `chore`    | Maintenance tasks                       |
| `revert`   | Reverting a previous commit             |
| `tweak`    | Small adjustments                       |
| `wip`      | Work in progress                        |
| `locale`   | Translation/locale updates              |

### Examples

```
feat(panel): add player activity heatmap
fix(core): prevent session loss on restart
docs: update development setup guide
locale: update French translations
```

## Testing

Tests use **Vitest**. Each test file should:

- Import `suite`, `it`, `expect` from `vitest`
- Wrap tests in a single `suite()` with `it()` calls

```sh
# Run all tests
npm run test --workspaces

# Run core tests only
cd core && npm run test

# Run a specific test file
cd core && npx vitest run path/to/file.test.ts

# Typecheck
npm run typecheck -w core
```

### What to Test

- All new utility functions and parsers
- Business logic in `core/lib/` and `core/modules/`
- API route handlers (integration tests welcome)
- Bug fixes should include a regression test

## `!NC` Tags

The `!NC` comment tag marks code that **must not be committed**. The pre-commit hook scans for these and blocks the commit if any are found. Use them for temporary debugging code or TODOs that must be resolved before merging.

```ts
console.log('debug output'); // !NC
```

## Pull Request Process

1. **Branch from `dev`** — all PRs target the `dev` branch, including translations
2. **Keep PRs focused** — one feature or fix per PR
3. **Run checks locally** before pushing:
    ```sh
    npm run test --workspaces
    npm run typecheck -w core
    npm run lint -w core
    npm run format:check
    ```
4. **Write a clear description** explaining what changed and why
5. **Link related issues** if applicable

## Project Structure

| Directory   | Description                                            |
| ----------- | ------------------------------------------------------ |
| `core/`     | Node.js backend — modules, routes, libraries           |
| `panel/`    | Web panel frontend (React + Radix + Tailwind)          |
| `nui/`      | In-game NUI menu (React + MUI, targets CEF/Chrome 103) |
| `shared/`   | Shared types, schemas, and utilities                   |
| `resource/` | FXServer Lua/JS game scripts                           |
| `scripts/`  | Build and dev tooling                                  |
| `locale/`   | 35 translation JSON files                              |
| `docs/`     | Project documentation                                  |

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
