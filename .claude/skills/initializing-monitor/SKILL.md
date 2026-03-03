# Initializing a Monitor

## Trigger
User wants to create a new dashboard, start a new monitor, or set up monitor-forge.

## Workflow

1. **Ask the user** what topic/domain they want to monitor (e.g., "Korean tech news", "global conflict", "crypto markets")

2. **Find the closest preset** and apply it:
   ```bash
   npx tsx forge/bin/forge.ts preset list --format json
   npx tsx forge/bin/forge.ts preset apply <preset-name> --format json
   ```

3. **Customize the monitor identity**:
   ```bash
   npx tsx forge/bin/forge.ts init --name "<Monitor Name>" --domain <domain> --format json --non-interactive
   ```

4. **Review current config**:
   ```bash
   npx tsx forge/bin/forge.ts source list --format json
   npx tsx forge/bin/forge.ts panel list --format json
   ```

5. **Suggest customizations** based on user's topic:
   - Additional RSS feeds relevant to their topic
   - Appropriate panel types
   - AI analysis custom prompt

6. **Validate**:
   ```bash
   npx tsx forge/bin/forge.ts validate --format json
   ```

## Available Presets

| Preset | Best For |
|--------|----------|
| blank | Starting from scratch |
| tech-minimal | Quick tech news dashboard |
| tech-full | Comprehensive tech intelligence |
| finance-minimal | Basic market tracking |
| finance-full | Full financial intelligence |
| geopolitics-minimal | Basic world news monitoring |
| geopolitics-full | Full geopolitical intelligence |

## Tips

- For topics not covered by presets, start with `blank` and add sources manually
- The user's topic may span multiple domains — mix sources from different presets
- Always end with `forge validate` to ensure the config is valid
