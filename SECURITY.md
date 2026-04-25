# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.6.x   | Current   |
| < 0.6   | No        |

The current minor line receives security patches. Older minors are
unsupported pre-1.0 — upgrade to the latest minor for fixes.

## Threat Model

defense-in-depth is a Git-hook-based governance middleware. As of v0.6 it
runs locally as a CLI, but **may make outbound network requests** when
opt-in features are enabled:

| Feature | Introduced | Network Behavior |
|---|---|---|
| `hollowArtifact.useDspy` | v0.5 | POST to `dspyEndpoint` (default `http://localhost:8080/evaluate`). Default: disabled. |
| `HttpTicketProvider` | v0.6 | GET against `parentEndpoint` for ticket state resolution. Default: `file` provider, no network. |
| `federation.parentEndpoint` | v0.6 | GET against parent project's resolution endpoint. Default: disabled. |

### Trust assumptions

- The user is expected to trust their `defense.config.yml`. A malicious config
  could redirect DSPy / federation calls to attacker-controlled endpoints.
- Endpoints are called server-side from the developer machine; SSRF mitigations
  (e.g. blocking RFC 1918 ranges) are **not** applied by default. Operators
  embedding defense-in-depth in CI runners with network egress should pin
  endpoints in config and review them like any other dependency.
- Provider responses are parsed as JSON and validated against the
  `TicketStateProvider` contract. Malformed or hostile responses degrade to
  WARN findings rather than crashing the pipeline.
- Provider failures (timeout, network error, non-2xx) are **non-fatal** by
  design: the engine produces a WARN finding and the guard pipeline continues.

### Out of scope

- Server-side enforcement: client-side hooks are bypassable via
  `git commit --no-verify`. Use the
  [`tamld/defense-in-depth/.github/actions/verify`](.github/actions/verify/action.yml)
  Composite Action (or an equivalent CI runner) to enforce guards on the
  server side. Branch protection rules are still required for end-to-end HITL.
- Sandboxing of user-authored guards: custom `Guard` implementations run with
  the privileges of the developer's shell. Treat third-party guards like any
  other Node dependency.

## Reporting a Vulnerability

If you discover a security vulnerability in defense-in-depth, please report
it responsibly.

**DO NOT open a public GitHub Issue for security vulnerabilities.**

Instead:

1. **Email**: Send details to the maintainer via GitHub private security advisory
2. **GitHub**: Use [GitHub's private vulnerability reporting](https://github.com/tamld/defense-in-depth/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Within 30 days for critical issues

## Responsible Disclosure

We follow [coordinated vulnerability disclosure](https://vuls.cert.org/confluence/display/Wiki/Vulnerability+Disclosure+Policy).
Credit will be given to reporters in the CHANGELOG.
