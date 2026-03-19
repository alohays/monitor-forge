import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { injectAuthHeader, type ProxyAuthConfig } from './key-injection.js';

describe('injectAuthHeader', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.TEST_API_KEY = process.env.TEST_API_KEY;
    savedEnv.CUSTOM_KEY = process.env.CUSTOM_KEY;
  });

  afterEach(() => {
    if (savedEnv.TEST_API_KEY === undefined) {
      delete process.env.TEST_API_KEY;
    } else {
      process.env.TEST_API_KEY = savedEnv.TEST_API_KEY;
    }
    if (savedEnv.CUSTOM_KEY === undefined) {
      delete process.env.CUSTOM_KEY;
    } else {
      process.env.CUSTOM_KEY = savedEnv.CUSTOM_KEY;
    }
  });

  const proxyConfig: Record<string, ProxyAuthConfig> = {
    'api.example.com': { envVar: 'TEST_API_KEY', header: 'Authorization', scheme: 'bearer' },
    'custom.api.com': { envVar: 'CUSTOM_KEY', header: 'X-API-Key', scheme: 'plain' },
  };

  it('injects Bearer token for bearer scheme', () => {
    process.env.TEST_API_KEY = 'my-secret-key';
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'api.example.com', proxyConfig);
    expect(result).toEqual({
      'User-Agent': 'MonitorForge/1.0',
      'Authorization': 'Bearer my-secret-key',
    });
  });

  it('injects plain key for plain scheme', () => {
    process.env.CUSTOM_KEY = 'plain-key-123';
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'custom.api.com', proxyConfig);
    expect(result).toEqual({
      'User-Agent': 'MonitorForge/1.0',
      'X-API-Key': 'plain-key-123',
    });
  });

  it('returns headers unchanged when domain not in config', () => {
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'unknown.com', proxyConfig);
    expect(result).toBe(headers);
  });

  it('returns headers unchanged when env var is not set', () => {
    delete process.env.TEST_API_KEY;
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'api.example.com', proxyConfig);
    expect(result).toBe(headers);
  });

  it('does not modify the original headers object', () => {
    process.env.TEST_API_KEY = 'key';
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'api.example.com', proxyConfig);
    expect(result).not.toBe(headers);
    expect(headers).toEqual({ 'User-Agent': 'MonitorForge/1.0' });
  });

  it('works with empty proxy config', () => {
    const headers = { 'User-Agent': 'MonitorForge/1.0' };
    const result = injectAuthHeader(headers, 'api.example.com', {});
    expect(result).toBe(headers);
  });
});
