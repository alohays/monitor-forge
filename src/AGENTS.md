# src/ — Frontend Engine

## Non-Obvious Rules
- `src/generated/` is auto-created by `forge build` — never edit or commit files here
- Path alias `@/*` maps to `./src/*` (configured in tsconfig.json and vite.config.ts)
- Map engine uses MapLibre GL + deck.gl — layers extend `LayerBase`
- Panel types extend `PanelBase`, sources extend `SourceBase`
- GeoJSON data files go in `data/geo/`, not in `src/`
