import type { ZodError, ZodIssue } from 'zod';

export interface ForgeOutput<T = unknown> {
  success: boolean;
  command: string;
  data: T;
  changes: Change[];
  warnings: string[];
  error?: string;
  errorCode?: ErrorCode;
  retryable?: boolean;
  recovery?: { suggestions: string[] };
  validationErrors?: FormattedValidationError[];
  next_steps?: string[];
}

export type ErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_EXISTS'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_NAME'
  | 'NOT_FOUND'
  | 'PARSE_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';

export interface FormattedValidationError {
  path: string;
  message: string;
  code: string;
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
    if (output.validationErrors && output.validationErrors.length > 0) {
      lines.push('');
      lines.push('Validation errors:');
      for (const ve of output.validationErrors) {
        lines.push(`  ${ve.path}: ${ve.message}`);
      }
    }
    if (output.recovery && output.recovery.suggestions.length > 0) {
      lines.push('');
      lines.push('Recovery suggestions:');
      for (const s of output.recovery.suggestions) {
        lines.push(`  - ${s}`);
      }
    }
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

export function formatZodErrors(zodError: ZodError): FormattedValidationError[] {
  return zodError.issues.map((issue: ZodIssue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

function classifyError(error: string): { errorCode: ErrorCode; retryable: boolean } {
  if (error.includes('Config file not found')) {
    return { errorCode: 'CONFIG_NOT_FOUND', retryable: false };
  }
  if (error.includes('already exists')) {
    if (error.includes('config') || error.includes('Config')) {
      return { errorCode: 'CONFIG_EXISTS', retryable: true };
    }
    return { errorCode: 'DUPLICATE_NAME', retryable: true };
  }
  if (error.includes('not found')) {
    return { errorCode: 'NOT_FOUND', retryable: false };
  }
  if (error.includes('JSON') || error.includes('parse') || error.includes('Parse')) {
    return { errorCode: 'PARSE_ERROR', retryable: false };
  }
  if (error.includes('permission') || error.includes('EACCES')) {
    return { errorCode: 'PERMISSION_ERROR', retryable: false };
  }
  return { errorCode: 'UNKNOWN_ERROR', retryable: false };
}

function suggestRecovery(errorCode: ErrorCode, command: string): string[] {
  switch (errorCode) {
    case 'CONFIG_NOT_FOUND':
      return ['Run `forge init` or `forge setup` to create a config file'];
    case 'CONFIG_EXISTS':
      return ['Use --force flag to overwrite existing config', 'Use forge commands to modify the existing config'];
    case 'DUPLICATE_NAME':
      return ['Choose a different name', `Use --upsert flag to update the existing item`];
    case 'NOT_FOUND':
      return [`Run \`forge ${command.split(' ')[0]} list\` to see available items`];
    case 'VALIDATION_ERROR':
      return ['Check the field paths above and fix the values', 'Run `forge validate` for full validation report'];
    case 'PARSE_ERROR':
      return ['Check JSON syntax in the config file', 'Run `forge validate` to find the issue'];
    case 'PERMISSION_ERROR':
      return ['Check file permissions on the config file'];
    default:
      return [];
  }
}

export function structuredFailure(
  command: string,
  error: string | Error,
  opts?: { warnings?: string[]; zodError?: ZodError },
): ForgeOutput<null> {
  const errorMessage = error instanceof Error ? error.message : error;
  const { errorCode, retryable } = classifyError(errorMessage);
  const suggestions = suggestRecovery(errorCode, command);

  const output: ForgeOutput<null> = {
    success: false,
    command,
    data: null,
    changes: [],
    warnings: opts?.warnings ?? [],
    error: errorMessage,
    errorCode,
    retryable,
    recovery: suggestions.length > 0 ? { suggestions } : undefined,
  };

  if (opts?.zodError) {
    output.errorCode = 'VALIDATION_ERROR';
    output.retryable = false;
    output.validationErrors = formatZodErrors(opts.zodError);
    output.recovery = {
      suggestions: suggestRecovery('VALIDATION_ERROR', command),
    };
  }

  return output;
}
