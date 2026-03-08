import type { Command } from 'commander';
import { existsSync, readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { configExists, writeConfig } from '../config/loader.js';
import { createDefaultConfig } from '../config/defaults.js';
import { MonitorForgeConfigSchema, type MonitorForgeConfig } from '../config/schema.js';
import { formatOutput, success, failure, type OutputFormat, type Change } from '../output/format.js';
import { collectRequiredEnvVars, parseEnvFile } from './env.js';

interface SetupParams {
  name: string;
  description: string;
  slug: string;
  preset: string;
  center: [number, number];
  projection: 'mercator' | 'globe';
  dayNight: boolean;
  aiEnabled: boolean;
  groqKey: string;
  openrouterKey: string;
}

interface SetupResult {
  config: MonitorForgeConfig;
  changes: Change[];
  warnings: string[];
}

function loadPresets(): Array<{ value: string; label: string; hint: string }> {
  const presetsDir = resolve(process.cwd(), 'presets');
  if (!existsSync(presetsDir)) return [];

  const files = readdirSync(presetsDir).filter(f => f.endsWith('.json'));
  const results: Array<{ value: string; label: string; hint: string }> = [];
  for (const f of files) {
    try {
      const content = JSON.parse(readFileSync(resolve(presetsDir, f), 'utf-8'));
      const name = basename(f, '.json');
      results.push({
        value: name,
        label: name,
        hint: `${content.monitor?.domain ?? 'general'} | ${content.sources?.length ?? 0} sources, ${content.panels?.length ?? 0} panels`,
      });
    } catch {
      console.error(`Warning: skipping malformed preset file "${f}"`);
    }
  }
  return results;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-monitor';
}

function buildAndWrite(params: SetupParams, dryRun: boolean): SetupResult {
  const changes: Change[] = [];
  const warnings: string[] = [];

  // Load preset
  let presetOverrides: Partial<MonitorForgeConfig> = {};
  if (params.preset !== 'blank') {
    const presetPath = resolve(process.cwd(), 'presets', `${params.preset}.json`);
    if (existsSync(presetPath)) {
      try {
        presetOverrides = JSON.parse(readFileSync(presetPath, 'utf-8'));
      } catch {
        warnings.push(`Preset "${params.preset}" has invalid JSON, using blank config.`);
      }
    } else {
      warnings.push(`Preset "${params.preset}" not found, using blank config.`);
    }
  }

  // Build AI config
  const aiConfig = params.aiEnabled
    ? (presetOverrides.ai && Object.keys(presetOverrides.ai.providers ?? {}).length > 0
        ? { ...presetOverrides.ai, enabled: true }
        : {
            enabled: true,
            fallbackChain: ['groq', 'openrouter'],
            providers: {
              groq: { model: 'llama-3.3-70b-versatile', apiKeyEnv: 'GROQ_API_KEY' },
              openrouter: { model: 'meta-llama/llama-3.3-70b-instruct', apiKeyEnv: 'OPENROUTER_API_KEY' },
            },
            analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false },
          })
    : {
        enabled: false,
        fallbackChain: [] as string[],
        providers: {},
        analysis: { summarization: false, entityExtraction: false, sentimentAnalysis: false, focalPointDetection: false },
      };

  const config = MonitorForgeConfigSchema.parse(createDefaultConfig({
    ...presetOverrides,
    monitor: {
      name: params.name,
      slug: params.slug,
      description: params.description || presetOverrides.monitor?.description || 'A custom real-time intelligence dashboard',
      domain: presetOverrides.monitor?.domain ?? 'general',
      tags: presetOverrides.monitor?.tags ?? [],
      branding: presetOverrides.monitor?.branding ?? { primaryColor: '#0052CC' },
    },
    map: Object.assign({}, presetOverrides.map, {
      center: params.center,
      projection: params.projection,
      dayNightOverlay: params.dayNight,
    }),
    ai: aiConfig,
  }));

  if (dryRun) {
    changes.push(
      { type: 'created', file: 'monitor-forge.config.json', description: 'Would create config file' },
      { type: 'created', file: '.env.local', description: 'Would create env file with API keys' },
      { type: 'created', file: '.env.example', description: 'Would generate env template' },
    );
  } else {
    // Write config
    const configPath = writeConfig(config);
    changes.push({ type: 'created', file: configPath, description: 'Created config file' });

    // Write .env.local (merge with existing)
    const envLocalPath = resolve(process.cwd(), '.env.local');
    let existing: Record<string, string> = {};
    if (existsSync(envLocalPath)) {
      existing = parseEnvFile(readFileSync(envLocalPath, 'utf-8'));
    }

    if (params.groqKey) existing['GROQ_API_KEY'] = params.groqKey;
    if (params.openrouterKey) existing['OPENROUTER_API_KEY'] = params.openrouterKey;

    const envVars = collectRequiredEnvVars(config);
    const envLines: string[] = [];
    for (const v of envVars) {
      const value = existing[v.key] ?? '';
      envLines.push(`# ${v.description}${v.required ? ' (required)' : ''}`);
      envLines.push(`${v.key}=${value}`);
      envLines.push('');
    }
    // Include any extra keys from existing .env.local not in envVars
    const envVarKeys = new Set(envVars.map(v => v.key));
    for (const [key, value] of Object.entries(existing)) {
      if (!envVarKeys.has(key)) {
        envLines.push(`${key}=${value}`);
        envLines.push('');
      }
    }

    writeFileSync(envLocalPath, envLines.join('\n'), 'utf-8');
    chmodSync(envLocalPath, 0o600);
    changes.push({ type: 'created', file: '.env.local', description: 'Created env file with API keys' });

    // Write .env.example
    const exampleContent = envVars.map(v =>
      `# ${v.description}${v.required ? ' (required)' : ' (optional)'}\n${v.key}=`
    ).join('\n\n') + '\n';
    writeFileSync(resolve(process.cwd(), '.env.example'), exampleContent, 'utf-8');
    changes.push({ type: 'created', file: '.env.example', description: 'Generated env template' });
  }

  // Validation warnings
  if (config.sources.length === 0) {
    warnings.push('No data sources configured. Run `forge source add` to add feeds.');
  }
  if (config.panels.length === 0) {
    warnings.push('No panels configured. Run `forge panel add` to add UI panels.');
  }
  if (params.aiEnabled && !params.groqKey && !params.openrouterKey) {
    warnings.push('AI is enabled but no API keys provided. Add keys to .env.local before running.');
  }

  return { config, changes, warnings };
}

async function runInteractiveWizard(dryRun: boolean): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' monitor-forge setup ')));

  // Check existing config
  if (configExists() && !dryRun) {
    const overwrite = await p.confirm({
      message: 'monitor-forge.config.json already exists. Overwrite?',
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }
  }

  // Step 1/5: Monitor identity
  p.log.step(pc.bold('Step 1/5') + ' — Monitor identity');

  const name = await p.text({
    message: 'What is the name of your monitor?',
    placeholder: 'My Intelligence Dashboard',
    defaultValue: 'My Monitor',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Name is required';
      if (val.length > 64) return 'Name must be 64 characters or less';
    },
  });
  if (p.isCancel(name)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const description = await p.text({
    message: 'Short description (optional):',
    placeholder: 'A custom real-time intelligence dashboard',
    defaultValue: '',
  });
  if (p.isCancel(description)) { p.cancel('Setup cancelled.'); process.exit(0); }

  // Step 2/5: Choose a preset
  p.log.step(pc.bold('Step 2/5') + ' — Choose a preset');

  const presets = loadPresets();
  let selectedPreset: string;

  if (presets.length === 0) {
    p.log.warn('No presets found. Using blank configuration.');
    selectedPreset = 'blank';
  } else {
    const preset = await p.select({
      message: 'Choose a starting preset:',
      options: presets,
    });
    if (p.isCancel(preset)) { p.cancel('Setup cancelled.'); process.exit(0); }
    selectedPreset = preset as string;
  }

  // Load preset to get defaults for subsequent steps
  let presetData: Partial<MonitorForgeConfig> = {};
  if (selectedPreset !== 'blank') {
    const presetPath = resolve(process.cwd(), 'presets', `${selectedPreset}.json`);
    if (existsSync(presetPath)) {
      try {
        presetData = JSON.parse(readFileSync(presetPath, 'utf-8'));
      } catch {
        p.log.warn(`Preset "${selectedPreset}" has invalid JSON, using defaults.`);
      }
    }
  }

  // Step 3/5: Map configuration
  p.log.step(pc.bold('Step 3/5') + ' — Map configuration');

  const projection = await p.select({
    message: 'Map projection:',
    options: [
      { value: 'mercator', label: 'Mercator', hint: 'Flat map — best for regional focus' },
      { value: 'globe', label: 'Globe', hint: '3D globe — best for global view' },
    ],
    initialValue: presetData.map?.projection ?? 'mercator',
  });
  if (p.isCancel(projection)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const defaultCenter = presetData.map?.center ?? [0, 20];
  const centerInput = await p.text({
    message: 'Map center (lng, lat):',
    placeholder: '0, 20',
    defaultValue: defaultCenter.join(', '),
    validate: (val) => {
      const parts = val.split(',').map(s => s.trim());
      if (parts.length !== 2) return 'Enter longitude, latitude (e.g. -95, 38)';
      const [lng, lat] = parts.map(Number);
      if (isNaN(lng) || isNaN(lat)) return 'Both values must be numbers';
      if (lng < -180 || lng > 180) return 'Longitude must be between -180 and 180';
      if (lat < -90 || lat > 90) return 'Latitude must be between -90 and 90';
    },
  });
  if (p.isCancel(centerInput)) { p.cancel('Setup cancelled.'); process.exit(0); }

  const dayNight = await p.confirm({
    message: 'Enable day/night terminator overlay?',
    initialValue: presetData.map?.dayNightOverlay ?? false,
  });
  if (p.isCancel(dayNight)) { p.cancel('Setup cancelled.'); process.exit(0); }

  // Step 4/5: AI analysis
  p.log.step(pc.bold('Step 4/5') + ' — AI analysis');

  const aiEnabled = await p.confirm({
    message: 'Enable AI-powered analysis? (summarization, entity extraction)',
    initialValue: presetData.ai?.enabled ?? true,
  });
  if (p.isCancel(aiEnabled)) { p.cancel('Setup cancelled.'); process.exit(0); }

  let groqKey = '';
  let openrouterKey = '';

  if (aiEnabled) {
    p.log.info(pc.dim('AI requires API keys. Free tiers available at:'));
    p.log.info(pc.dim('  Groq: https://console.groq.com'));
    p.log.info(pc.dim('  OpenRouter: https://openrouter.ai/keys'));

    const gk = await p.text({
      message: 'Groq API key (press Enter to skip):',
      placeholder: 'gsk_...',
      defaultValue: '',
    });
    if (p.isCancel(gk)) { p.cancel('Setup cancelled.'); process.exit(0); }
    groqKey = gk as string;

    const ork = await p.text({
      message: 'OpenRouter API key (press Enter to skip):',
      placeholder: 'sk-or-...',
      defaultValue: '',
    });
    if (p.isCancel(ork)) { p.cancel('Setup cancelled.'); process.exit(0); }
    openrouterKey = ork as string;
  }

  // Step 5/5: Create
  p.log.step(pc.bold('Step 5/5') + ' — Creating your dashboard');

  const s = p.spinner();
  s.start('Generating configuration...');

  const [lng, lat] = (centerInput as string).split(',').map(s => parseFloat(s.trim()));

  const result = buildAndWrite({
    name: name as string,
    description: description as string,
    slug: toSlug(name as string),
    preset: selectedPreset,
    center: [lng, lat],
    projection: projection as 'mercator' | 'globe',
    dayNight: dayNight as boolean,
    aiEnabled: aiEnabled as boolean,
    groqKey,
    openrouterKey,
  }, dryRun);

  s.stop('Configuration complete!');

  // Summary
  p.log.success(pc.green('Dashboard created successfully!'));
  p.log.info(`  Name: ${pc.bold(result.config.monitor.name)}`);
  p.log.info(`  Preset: ${pc.bold(selectedPreset)}`);
  p.log.info(`  Sources: ${pc.bold(String(result.config.sources.length))}`);
  p.log.info(`  Panels: ${pc.bold(String(result.config.panels.length))}`);
  p.log.info(`  AI: ${pc.bold(result.config.ai.enabled ? 'enabled' : 'disabled')}`);
  p.log.info(`  Projection: ${pc.bold(result.config.map.projection)}`);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      p.log.warn(pc.yellow(w));
    }
  }

  p.note(
    [
      `${pc.dim('$')} npm run validate`,
      `${pc.dim('$')} npm run dev`,
    ].join('\n'),
    'Next steps',
  );

  p.outro(pc.bgGreen(pc.black(' Happy monitoring! ')));
}

function runNonInteractive(
  opts: Record<string, unknown>,
  format: OutputFormat,
  dryRun: boolean,
): void {
  if (configExists() && !dryRun) {
    console.log(formatOutput(
      failure('setup', 'monitor-forge.config.json already exists. Delete it first or use --dry-run.'),
      format,
    ));
    process.exit(1);
  }

  const name = (opts.name as string) ?? 'My Monitor';
  const desc = (opts.description as string) ?? '';
  const template = (opts.template as string) ?? 'blank';
  const centerStr = opts.center as string | undefined;
  let center: [number, number] = [0, 20];
  if (centerStr) {
    const parts = centerStr.split(',').map(s => s.trim());
    if (parts.length !== 2) {
      console.log(formatOutput(
        failure('setup', 'Invalid center format. Expected "lng,lat" (e.g. "-95,38").'),
        format,
      ));
      process.exit(1);
    }
    const [lng, lat] = parts.map(s => parseFloat(s));
    if (isNaN(lng) || isNaN(lat)) {
      console.log(formatOutput(
        failure('setup', 'Invalid center coordinates. Both values must be numbers.'),
        format,
      ));
      process.exit(1);
    }
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      console.log(formatOutput(
        failure('setup', 'Center coordinates out of range. Longitude: -180..180, Latitude: -90..90.'),
        format,
      ));
      process.exit(1);
    }
    center = [lng, lat];
  }
  const projectionRaw = (opts.projection as string) ?? 'mercator';
  if (projectionRaw !== 'mercator' && projectionRaw !== 'globe') {
    console.log(formatOutput(
      failure('setup', `Invalid projection "${projectionRaw}". Must be "mercator" or "globe".`),
      format,
    ));
    process.exit(1);
  }
  const projection = projectionRaw as 'mercator' | 'globe';
  const dayNight = !!opts.dayNight;
  const aiEnabled = opts.ai !== false;
  const groqKey = (opts.groqKey as string) ?? '';
  const openrouterKey = (opts.openrouterKey as string) ?? '';

  const result = buildAndWrite({
    name,
    description: desc,
    slug: toSlug(name),
    preset: template,
    center,
    projection,
    dayNight,
    aiEnabled,
    groqKey,
    openrouterKey,
  }, dryRun);

  console.log(formatOutput(
    success('setup', {
      name: result.config.monitor.name,
      slug: result.config.monitor.slug,
      preset: template,
      sources: result.config.sources.length,
      layers: result.config.layers.length,
      panels: result.config.panels.length,
      aiEnabled: result.config.ai.enabled,
      projection: result.config.map.projection,
    }, {
      changes: result.changes,
      warnings: result.warnings,
      next_steps: [
        'forge validate',
        'forge dev',
      ],
    }),
    format,
  ));
}

export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard — go from zero to running dashboard')
    .option('--name <name>', 'Monitor name')
    .option('--description <desc>', 'Short description')
    .option('--template <preset>', 'Starting preset')
    .option('--center <coords>', 'Map center as "lng,lat"')
    .option('--projection <proj>', 'Map projection: mercator or globe')
    .option('--day-night', 'Enable day/night overlay')
    .option('--ai', 'Enable AI analysis')
    .option('--no-ai', 'Disable AI analysis')
    .option('--groq-key <key>', 'Groq API key')
    .option('--openrouter-key <key>', 'OpenRouter API key')
    .action(async (opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const nonInteractive = program.opts().nonInteractive ?? false;
      const dryRun = program.opts().dryRun ?? false;

      if (format === 'json' || nonInteractive) {
        runNonInteractive(opts, format, dryRun);
      } else {
        await runInteractiveWizard(dryRun);
      }
    });
}
