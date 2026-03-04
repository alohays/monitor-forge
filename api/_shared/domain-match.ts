/**
 * Check if a hostname matches an allowlist entry.
 * Supports exact matches, wildcard prefixes (*.example.com), and global wildcard (*).
 * Edge-runtime safe (no Node.js APIs).
 */
export function isDomainAllowed(hostname: string, allowedDomains: readonly string[]): boolean {
  const h = hostname.toLowerCase();
  for (const pattern of allowedDomains) {
    const p = pattern.toLowerCase();
    if (p === '*') return true;
    if (p === h) return true;
    if (p.startsWith('*.')) {
      const suffix = p.slice(1); // ".example.com"
      if (h.endsWith(suffix) && h.length > suffix.length) return true;
      // Also match the bare domain (e.g., "example.com" matches "*.example.com")
      if (h === p.slice(2)) return true;
    }
  }
  return false;
}
