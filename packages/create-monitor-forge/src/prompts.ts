import * as p from '@clack/prompts';
import pc from 'picocolors';
import { PRESETS } from './presets.js';
import type { ScaffoldOptions } from './scaffold.js';

export async function runInteractive(defaults: {
  directory?: string;
  template: string;
  ai: boolean;
  install: boolean;
}): Promise<ScaffoldOptions> {
  p.intro(pc.bgCyan(pc.black(' create-monitor-forge ')));

  const directory = await p.text({
    message: 'Project directory name:',
    placeholder: 'my-dashboard',
    initialValue: defaults.directory ?? '',
    validate(value) {
      if (!value || value.trim().length === 0) {
        return 'Directory name is required';
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
        return 'Directory name can only contain letters, numbers, hyphens, dots, and underscores';
      }
      return undefined;
    },
  });

  if (p.isCancel(directory)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const template = await p.select({
    message: 'Choose a preset template:',
    initialValue: defaults.template,
    options: PRESETS.map((preset) => ({
      value: preset.name,
      label: preset.name,
      hint: `${preset.description} (${preset.sourceCount} sources)`,
    })),
  });

  if (p.isCancel(template)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const ai = await p.confirm({
    message: 'Enable AI features?',
    initialValue: defaults.ai,
  });

  if (p.isCancel(ai)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const install = await p.confirm({
    message: 'Run npm install?',
    initialValue: defaults.install,
  });

  if (p.isCancel(install)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }

  const projectName = directory;

  return {
    directory,
    projectName,
    template: template as string,
    ai,
    install,
  };
}
