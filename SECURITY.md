# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Current |

## Reporting a Vulnerability

If you discover a security vulnerability in defend-in-depth, please report it responsibly.

**DO NOT open a public GitHub Issue for security vulnerabilities.**

Instead:

1. **Email**: Send details to the maintainer via GitHub private security advisory
2. **GitHub**: Use [GitHub's private vulnerability reporting](https://github.com/tamld/defend-in-depth/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Within 30 days for critical issues

### Scope

defend-in-depth is a **local CLI tool** that runs Git hooks. It does NOT:
- Make network requests
- Store credentials
- Access external services

Security concerns are primarily around:
- Malicious guard code execution
- Config file injection
- Hook script injection

## Responsible Disclosure

We follow [coordinated vulnerability disclosure](https://vuls.cert.org/confluence/display/Wiki/Vulnerability+Disclosure+Policy).
Credit will be given to reporters in the CHANGELOG.
