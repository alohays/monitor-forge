import { describe, it, expect } from 'vitest';
import { isDomainAllowed } from './domain-match.js';

describe('isDomainAllowed', () => {
  it('matches exact domain', () => {
    expect(isDomainAllowed('api.example.com', ['api.example.com'])).toBe(true);
  });

  it('rejects non-matching domain', () => {
    expect(isDomainAllowed('evil.com', ['api.example.com'])).toBe(false);
  });

  it('wildcard * matches everything', () => {
    expect(isDomainAllowed('anything.com', ['*'])).toBe(true);
  });

  it('*.example.com matches subdomains', () => {
    expect(isDomainAllowed('api.example.com', ['*.example.com'])).toBe(true);
    expect(isDomainAllowed('feeds.example.com', ['*.example.com'])).toBe(true);
  });

  it('*.example.com matches bare domain', () => {
    expect(isDomainAllowed('example.com', ['*.example.com'])).toBe(true);
  });

  it('*.example.com does NOT match evil-example.com', () => {
    expect(isDomainAllowed('evil-example.com', ['*.example.com'])).toBe(false);
  });

  it('matching is case-insensitive', () => {
    expect(isDomainAllowed('API.Example.COM', ['api.example.com'])).toBe(true);
    expect(isDomainAllowed('api.example.com', ['API.Example.COM'])).toBe(true);
  });

  it('empty allowlist rejects everything', () => {
    expect(isDomainAllowed('api.example.com', [])).toBe(false);
  });

  it('matches against multiple entries', () => {
    const list = ['api.example.com', '*.cdn.net'];
    expect(isDomainAllowed('api.example.com', list)).toBe(true);
    expect(isDomainAllowed('static.cdn.net', list)).toBe(true);
    expect(isDomainAllowed('evil.com', list)).toBe(false);
  });

  it('does not match partial domain names', () => {
    expect(isDomainAllowed('notexample.com', ['example.com'])).toBe(false);
  });
});
