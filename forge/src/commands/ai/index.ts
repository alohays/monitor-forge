import type { Command } from 'commander';
import { loadConfig, updateConfig } from '../../config/loader.js';
import { formatOutput, success, failure, type OutputFormat } from '../../output/format.js';

export function registerAICommands(program: Command): void {
  const ai = program.command('ai').description('Configure AI analysis pipeline');

  ai
    .command('configure')
    .description('Configure AI provider and analysis settings')
    .option('--provider <name>', 'Provider name (groq, openrouter, or custom)')
    .option('--model <model>', 'Model identifier')
    .option('--api-key-env <envVar>', 'Environment variable name for API key')
    .option('--base-url <url>', 'Custom API base URL')
    .option('--fallback-chain <providers...>', 'Ordered fallback provider list')
    .option('--custom-prompt <prompt>', 'Custom analysis prompt')
    .option('--enable-summarization', 'Enable news summarization')
    .option('--enable-entity-extraction', 'Enable entity extraction')
    .option('--enable-sentiment', 'Enable sentiment analysis')
    .option('--enable-focal-point', 'Enable focal point detection')
    .option('--disable-ai', 'Disable AI entirely')
    .action((opts) => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      const dryRun = program.opts().dryRun ?? false;

      try {
        if (dryRun) {
          console.log(formatOutput(
            success('ai configure --dry-run', opts, {
              changes: [{ type: 'modified', file: 'monitor-forge.config.json', description: 'Would update AI configuration' }],
            }),
            format,
          ));
          return;
        }

        const { config, path } = updateConfig(cfg => {
          const ai = { ...cfg.ai };

          if (opts.disableAi) {
            ai.enabled = false;
          } else {
            ai.enabled = true;
          }

          if (opts.provider && opts.model) {
            const providerName = opts.provider;
            ai.providers = {
              ...ai.providers,
              [providerName]: {
                model: opts.model,
                apiKeyEnv: opts.apiKeyEnv ?? `${providerName.toUpperCase().replace(/-/g, '_')}_API_KEY`,
                ...(opts.baseUrl ? { baseUrl: opts.baseUrl } : {}),
              },
            };
          }

          if (opts.fallbackChain) {
            ai.fallbackChain = opts.fallbackChain;
          }

          const analysis = { ...ai.analysis };
          if (opts.customPrompt !== undefined) analysis.customPrompt = opts.customPrompt;
          if (opts.enableSummarization !== undefined) analysis.summarization = true;
          if (opts.enableEntityExtraction !== undefined) analysis.entityExtraction = true;
          if (opts.enableSentiment !== undefined) analysis.sentimentAnalysis = true;
          if (opts.enableFocalPoint !== undefined) analysis.focalPointDetection = true;
          ai.analysis = analysis;

          return { ...cfg, ai };
        });

        console.log(formatOutput(
          success('ai configure', config.ai, {
            changes: [{ type: 'modified', file: path, description: 'Updated AI configuration' }],
            next_steps: ['forge env check', 'forge validate'],
          }),
          format,
        ));
      } catch (err) {
        console.log(formatOutput(failure('ai configure', String(err)), format));
        process.exit(1);
      }
    });

  ai
    .command('status')
    .description('Show current AI configuration status')
    .action(() => {
      const format = (program.opts().format ?? 'table') as OutputFormat;
      try {
        const config = loadConfig();
        const status = {
          enabled: config.ai.enabled,
          fallbackChain: config.ai.fallbackChain,
          providers: Object.entries(config.ai.providers).map(([name, p]) => ({
            name,
            model: p.model,
            apiKeyEnv: p.apiKeyEnv,
            keySet: !!process.env[p.apiKeyEnv],
          })),
          analysis: config.ai.analysis,
        };
        console.log(formatOutput(success('ai status', status), format));
      } catch (err) {
        console.log(formatOutput(failure('ai status', String(err)), format));
        process.exit(1);
      }
    });
}
