import { describe, it, expect } from 'vitest';
import { formatOutput, success, failure, type ForgeOutput, type OutputFormat } from './format.js';

describe('success', () => {
  it('returns ForgeOutput with success true', () => {
    const output = success('test', { key: 'value' });
    expect(output.success).toBe(true);
    expect(output.command).toBe('test');
    expect(output.data).toEqual({ key: 'value' });
  });

  it('includes changes and warnings when provided', () => {
    const output = success('test', null, {
      changes: [{ type: 'created', file: 'test.ts', description: 'Created file' }],
      warnings: ['Watch out!'],
      next_steps: ['Run tests'],
    });
    expect(output.changes).toHaveLength(1);
    expect(output.warnings).toEqual(['Watch out!']);
    expect(output.next_steps).toEqual(['Run tests']);
  });

  it('defaults changes to empty array', () => {
    const output = success('test', null);
    expect(output.changes).toEqual([]);
    expect(output.warnings).toEqual([]);
  });
});

describe('failure', () => {
  it('returns ForgeOutput with success false and data null', () => {
    const output = failure('test', 'Something broke');
    expect(output.success).toBe(false);
    expect(output.data).toBeNull();
    expect(output.error).toBe('Something broke');
  });

  it('includes warnings when provided', () => {
    const output = failure('test', 'Error', ['Warning1']);
    expect(output.warnings).toEqual(['Warning1']);
  });
});

describe('formatOutput', () => {
  describe('json format', () => {
    it('returns pretty-printed JSON', () => {
      const output = success('test', { key: 'value' });
      const result = formatOutput(output, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.data.key).toBe('value');
    });

    it('includes all ForgeOutput fields', () => {
      const output = success('test', { k: 1 }, {
        changes: [{ type: 'modified', file: 'f.ts', description: 'd' }],
        warnings: ['w'],
        next_steps: ['s'],
      });
      const result = JSON.parse(formatOutput(output, 'json'));
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('command');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('next_steps');
    });
  });

  describe('minimal format', () => {
    it('returns JSON of data on success', () => {
      const output = success('test', { key: 'value' });
      const result = formatOutput(output, 'minimal');
      expect(JSON.parse(result)).toEqual({ key: 'value' });
    });

    it('returns OK when data is null on success', () => {
      const output = success('test', null);
      const result = formatOutput(output, 'minimal');
      expect(result).toBe('OK');
    });

    it('returns ERROR: message on failure', () => {
      const output = failure('test', 'Something broke');
      const result = formatOutput(output, 'minimal');
      expect(result).toBe('ERROR: Something broke');
    });
  });

  describe('table format', () => {
    it('renders array data as aligned columns', () => {
      const output = success('test', [
        { name: 'a', type: 'rss' },
        { name: 'bb', type: 'api' },
      ]);
      const result = formatOutput(output, 'table');
      expect(result).toContain('name');
      expect(result).toContain('type');
      expect(result).toContain('---');
      expect(result).toContain('a');
      expect(result).toContain('bb');
    });

    it('renders object data as key-value pairs', () => {
      const output = success('test', { valid: true, count: 5 });
      const result = formatOutput(output, 'table');
      expect(result).toContain('valid: true');
      expect(result).toContain('count: 5');
    });

    it('shows (no items) for empty array', () => {
      const output = success('test', []);
      const result = formatOutput(output, 'table');
      expect(result).toContain('(no items)');
    });

    it('renders changes section with icons', () => {
      const output = success('test', null, {
        changes: [
          { type: 'created', file: 'new.ts', description: 'Created' },
          { type: 'modified', file: 'old.ts', description: 'Modified' },
          { type: 'deleted', file: 'gone.ts', description: 'Deleted' },
        ],
      });
      const result = formatOutput(output, 'table');
      expect(result).toContain('[+] new.ts');
      expect(result).toContain('[~] old.ts');
      expect(result).toContain('[-] gone.ts');
    });

    it('renders warnings section', () => {
      const output = success('test', null, { warnings: ['Beware!'] });
      const result = formatOutput(output, 'table');
      expect(result).toContain('Warnings:');
      expect(result).toContain('! Beware!');
    });

    it('renders next steps section', () => {
      const output = success('test', null, { next_steps: ['forge build'] });
      const result = formatOutput(output, 'table');
      expect(result).toContain('Next steps:');
      expect(result).toContain('- forge build');
    });

    it('shows error message on failure', () => {
      const output = failure('test', 'Config invalid');
      const result = formatOutput(output, 'table');
      expect(result).toContain('Error: Config invalid');
    });
  });
});
