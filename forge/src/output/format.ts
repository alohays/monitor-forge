export interface ForgeOutput<T = unknown> {
  success: boolean;
  command: string;
  data: T;
  changes: Change[];
  warnings: string[];
  error?: string;
  next_steps?: string[];
}

export interface Change {
  type: 'created' | 'modified' | 'deleted';
  file: string;
  description: string;
}

export type OutputFormat = 'json' | 'table' | 'minimal';

export function formatOutput<T>(
  output: ForgeOutput<T>,
  format: OutputFormat,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(output, null, 2);
    case 'minimal':
      return output.success
        ? output.data !== null ? JSON.stringify(output.data) : 'OK'
        : `ERROR: ${output.error}`;
    case 'table':
    default:
      return formatTable(output);
  }
}

function formatTable<T>(output: ForgeOutput<T>): string {
  const lines: string[] = [];

  if (!output.success) {
    lines.push(`Error: ${output.error}`);
    return lines.join('\n');
  }

  // Format data based on type
  const data = output.data;
  if (Array.isArray(data)) {
    if (data.length === 0) {
      lines.push('(no items)');
    } else {
      // Simple table for arrays of objects
      const keys = Object.keys(data[0] as object);
      const widths = keys.map(k =>
        Math.max(k.length, ...data.map(item => String((item as Record<string, unknown>)[k] ?? '').length))
      );

      lines.push(keys.map((k, i) => k.padEnd(widths[i])).join('  '));
      lines.push(widths.map(w => '-'.repeat(w)).join('  '));
      for (const item of data) {
        lines.push(keys.map((k, i) => String((item as Record<string, unknown>)[k] ?? '').padEnd(widths[i])).join('  '));
      }
    }
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      lines.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }

  if (output.changes.length > 0) {
    lines.push('');
    lines.push('Changes:');
    for (const change of output.changes) {
      const icon = change.type === 'created' ? '+' : change.type === 'modified' ? '~' : '-';
      lines.push(`  [${icon}] ${change.file} - ${change.description}`);
    }
  }

  if (output.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of output.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  if (output.next_steps && output.next_steps.length > 0) {
    lines.push('');
    lines.push('Next steps:');
    for (const step of output.next_steps) {
      lines.push(`  - ${step}`);
    }
  }

  return lines.join('\n');
}

export function success<T>(
  command: string,
  data: T,
  opts?: { changes?: Change[]; warnings?: string[]; next_steps?: string[] },
): ForgeOutput<T> {
  return {
    success: true,
    command,
    data,
    changes: opts?.changes ?? [],
    warnings: opts?.warnings ?? [],
    next_steps: opts?.next_steps,
  };
}

export function failure(command: string, error: string, warnings?: string[]): ForgeOutput<null> {
  return {
    success: false,
    command,
    data: null,
    changes: [],
    warnings: warnings ?? [],
    error,
  };
}
