# Adding Map Layers

## Trigger
User wants to add map visualizations, GeoJSON layers, or geographic data to their dashboard.

## Layer Types

| Type | Visualization | Best For |
|------|--------------|----------|
| `points` | Scattered dots | Event locations, cities, facilities |
| `lines` | Path/routes | Trade routes, borders, migration |
| `polygons` | Filled regions | Countries, zones, territories |
| `heatmap` | Density gradient | Concentration of events |
| `hexagon` | 3D hexagonal bins | Aggregated data density |

## Adding a Layer

### Step 1: Prepare GeoJSON Data

Place a `.geojson` file in `data/geo/`. Standard GeoJSON format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [longitude, latitude] },
      "properties": { "name": "...", "value": 0 }
    }
  ]
}
```

### Step 2: Add the Layer

```bash
npx tsx forge/bin/forge.ts layer add <type> \
  --name "<lowercase-hyphenated>" \
  --display-name "<Display Name>" \
  --data-path "data/geo/<filename>.geojson" \
  --color "#RRGGBB" \
  --category <category> \
  --format json --non-interactive
```

### Step 3: Validate

```bash
npx tsx forge/bin/forge.ts validate --format json
```

## Examples

### Conflict Hotspots (Points)
```bash
npx tsx forge/bin/forge.ts layer add points \
  --name "conflict-hotspots" \
  --display-name "Conflict Hotspots" \
  --data-path "data/geo/conflicts.geojson" \
  --color "#FF4444" \
  --category security \
  --format json --non-interactive
```

### Country Boundaries (Polygons)
```bash
npx tsx forge/bin/forge.ts layer add polygons \
  --name "country-risk" \
  --display-name "Country Risk Levels" \
  --data-path "data/geo/countries.geojson" \
  --color "#FF8800" \
  --category risk \
  --format json --non-interactive
```

## Managing Layers

```bash
npx tsx forge/bin/forge.ts layer list --format json
npx tsx forge/bin/forge.ts layer remove <name> --format json
```

## Tips

- GeoJSON coordinates are [longitude, latitude] (not lat, lon)
- Colors are 6-digit hex codes: `#FF0000` (red), `#00FF00` (green), `#0000FF` (blue)
- For API-sourced layers, use `--data-source api` and `--data-url <url>` instead of `--data-path`
