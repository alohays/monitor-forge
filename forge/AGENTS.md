# forge/ — CLI Tool

## Key Constraint
The Zod schema at `src/config/schema.ts` is the single source of truth for valid config. Read it before modifying config-related code.

## Non-Obvious Rules
- `forge build` generates manifests into `../src/generated/` — these are gitignored, never edit manually
- All commands must support `--format json` and `--non-interactive` flags
- Output must follow the JSON contract: `{ success, command, data, changes, warnings, next_steps }`
- Source names: lowercase alphanumeric + hyphens only
- Colors: 6-digit hex (e.g. `#FF0000`)
