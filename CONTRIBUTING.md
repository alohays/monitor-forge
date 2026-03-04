# Contributing to monitor-forge

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/alohays/monitor-forge.git
cd monitor-forge
npm install    # installs dependencies and auto-generates manifests
npm run dev    # starts dev server at http://localhost:5173
```

## Important Rules

1. **Never manually edit `monitor-forge.config.json`** — always use the forge CLI
2. **Always validate before building**: `npm run forge -- validate`
3. **All code, comments, commit messages, and documentation must be in English**

## Making Changes

### Branch Strategy

- Create feature branches from `main`
- Use descriptive branch names: `feat/add-panel-type`, `fix/rss-parsing`, `docs/contributing`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `chore:` — maintenance
- `refactor:` — code restructuring
- `test:` — adding or updating tests

### Before Submitting a PR

Run all checks:

```bash
npm test                                              # run tests
npm run forge -- build --skip-vite --format json      # generate manifests (required for typecheck)
npm run typecheck                                     # TypeScript check
npm run forge -- validate --format json               # config validation
```

## How to Contribute

### Adding a New Preset

1. Create a JSON file in `presets/` following the existing format
2. The config schema at `forge/src/config/schema.ts` (Zod) is the single source of truth
3. Source names must be lowercase alphanumeric with hyphens
4. Colors must be 6-digit hex codes
5. Validate: `npm run forge -- validate`

### Adding a New Panel Type

1. Create a new panel class extending `PanelBase` in `src/core/panels/`
2. Register it in the panel registry
3. Add corresponding tests
4. All user-facing content must be sanitized with DOMPurify

### Adding a New Source Type

1. Create a new source class extending `SourceBase` in `src/core/sources/`
2. Register it in the source registry
3. Add corresponding tests

### Adding a New Map Layer

1. GeoJSON files go in `data/geo/`, not in `src/`
2. Supported layer types: points, lines, polygons, heatmap, hexagon

## Code Style

- TypeScript strict mode
- Use DOMPurify for all innerHTML/user-facing content
- Edge Functions (in `api/`) must not use Node.js APIs (no `fs`, `path`, `Buffer`)
- Use shared utilities from `api/_shared/` for API responses

## Questions?

Open a [Discussion](https://github.com/alohays/monitor-forge/discussions) for questions that aren't bug reports or feature requests.
