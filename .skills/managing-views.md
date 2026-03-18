# Managing Views

Views organize panels into tabs in the dashboard UI. Each view references one or more panels by name.

## Prerequisites

- Panels must exist before they can be added to a view
- Run `forge panel list` to see available panels

## Add a View

```bash
# Add a view with panels (comma-separated)
forge view add overview --display-name "Overview" --panels "news-feed,ai-brief" --default

# Idempotent: update if exists, create if not
forge view add overview --display-name "Overview" --panels "news-feed,ai-brief,status" --default --upsert
```

## List Views

```bash
forge view list
```

## Set Default View

```bash
forge view set-default overview
```

## Remove a View

```bash
# Removes the view only; panels are NOT deleted
forge view remove overview
```

## Validation Rules

- View names: lowercase alphanumeric with hyphens
- At most one view can be `--default`
- All referenced panels must exist in config
- Panels not in any view generate orphan warnings during `forge validate`

## Direct Config Editing

When CLI is insufficient (e.g., reordering views, bulk updates):

```json
{
  "views": [
    {
      "name": "overview",
      "displayName": "Overview",
      "panels": ["news-feed", "ai-brief"],
      "default": true
    },
    {
      "name": "analysis",
      "displayName": "Analysis",
      "panels": ["ai-brief", "entity-tracker"]
    }
  ]
}
```

Always run `forge validate` after direct edits.
