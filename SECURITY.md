# Security Policy

## Supported Versions

We support security updates for the following versions:

| Version | Supported |
| ------- | --------- |
| v0.x    | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please do not open a public issue. Instead, report it by emailing the maintainers. We aim to respond within 48 hours and coordinate a fix.

### Security Model
Sketch2Mermaid v0 is a static frontend-only application:
- No backend server or cloud database.
- Mermaid is executed with `securityLevel: "strict"`.
- User labels are escaped character-by-character to prevent XSS.
- All HTTP security headers should be applied by the hosting provider where supported.
