import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerSchemaCommand } from '../schema.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>', 'Output format', 'json');
  registerSchemaCommand(program);
  return program;
}

class ExitError extends Error {
  constructor(public code: number) { super(`exit ${code}`); }
}

async function runCommand(args: string[]): Promise<string> {
  const outputs: string[] = [];
  const origLog = console.log;
  console.log = (msg: string) => outputs.push(msg);
  const origExit = process.exit;
  process.exit = ((code?: number) => { throw new ExitError(code ?? 0); }) as never;

  try {
    const program = createProgram();
    await program.parseAsync(['node', 'forge', ...args]);
  } catch (err) {
    if (!(err instanceof ExitError)) throw err;
  } finally {
    console.log = origLog;
    process.exit = origExit;
  }

  return outputs[0] ?? '';
}

// ─── forge schema (full) ─────────────────────────────────────

describe('forge schema (full)', () => {
  it('contains $schema or type key and properties', async () => {
    const output = await runCommand(['schema']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    const schema = result.data;
    const hasSchemaKey = '$schema' in schema || 'type' in schema;
    expect(hasSchemaKey).toBe(true);
    expect(schema.properties ?? schema.definitions ?? schema).toBeDefined();
  });

  it('_note field is present in full schema output', async () => {
    const output = await runCommand(['schema']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data._note).toBe(
      'Zod .refine() validators are not represented in JSON Schema output',
    );
  });
});

// ─── forge schema <section> ──────────────────────────────────

describe('forge schema sources', () => {
  it('returns valid sub-schema with source-related properties', async () => {
    const output = await runCommand(['schema', 'sources']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    const schema = result.data;
    // Sub-schema must be a real JSON Schema object
    expect(typeof schema).toBe('object');
    expect(schema).not.toBeNull();
    // Must have at least one of the standard JSON Schema keys
    const hasSchemaStructure =
      'type' in schema ||
      '$schema' in schema ||
      'properties' in schema ||
      'definitions' in schema ||
      'anyOf' in schema ||
      'oneOf' in schema;
    expect(hasSchemaStructure).toBe(true);
  });

  it('_note field is present in section schema output', async () => {
    const output = await runCommand(['schema', 'sources']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data._note).toBe(
      'Zod .refine() validators are not represented in JSON Schema output',
    );
  });
});

// ─── forge schema invalid-section ───────────────────────────

describe('forge schema invalid-section', () => {
  it('triggers structured failure with helpful error', async () => {
    const output = await runCommand(['schema', 'invalid-section']);
    const result = JSON.parse(output);
    expect(result.success).toBe(false);
    // Error message should name the invalid section
    expect(result.error).toContain('invalid-section');
    // Error message should list valid sections as hints
    expect(result.error).toContain('sources');
    expect(result.error).toContain('monitor');
  });
});

// ─── _note present in all valid sections ────────────────────

describe('_note field in all valid sections', () => {
  const validSections = [
    'monitor',
    'sources',
    'layers',
    'panels',
    'views',
    'ai',
    'map',
    'backend',
    'build',
    'theme',
  ];

  for (const section of validSections) {
    it(`_note is present for section "${section}"`, async () => {
      const output = await runCommand(['schema', section]);
      const result = JSON.parse(output);
      expect(result.success).toBe(true);
      expect(result.data._note).toBe(
        'Zod .refine() validators are not represented in JSON Schema output',
      );
    });
  }
});

// ─── all valid sections return valid output ──────────────────

describe('all valid sections return valid schema output', () => {
  const validSections = [
    'monitor',
    'sources',
    'layers',
    'panels',
    'views',
    'ai',
    'map',
    'backend',
    'build',
    'theme',
  ];

  for (const section of validSections) {
    it(`section "${section}" returns success with schema object`, async () => {
      const output = await runCommand(['schema', section]);
      const result = JSON.parse(output);
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('object');
      expect(result.data).not.toBeNull();
    });
  }
});
