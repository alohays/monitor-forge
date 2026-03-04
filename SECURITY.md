# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, email us at **dldbstjd9751@gmail.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to provide a detailed response within 7 days.

## Security Measures

monitor-forge includes the following security features:

- **DOMPurify**: All user-facing content is sanitized to prevent XSS
- **Content Security Policy**: Strict CSP headers on deployed dashboards
- **Proxy Domain Allowlist**: The CORS proxy only forwards requests to explicitly allowed domains
- **Rate Limiting**: Built-in request throttling on API endpoints
- **Security Headers**: HSTS, X-Frame-Options, Permissions-Policy, Referrer-Policy on Vercel deployments

## Scope

The following are considered in scope:

- XSS vulnerabilities in panel rendering
- CORS proxy bypass or abuse
- API endpoint security issues
- Dependency vulnerabilities with known exploits

The following are out of scope:

- Vulnerabilities in third-party services (Groq, OpenRouter, Vercel)
- Issues requiring physical access to the deployment server
- Social engineering attacks
