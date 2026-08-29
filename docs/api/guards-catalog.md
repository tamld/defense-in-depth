# Built-in Guards Catalog & API Specification

> **Detailed reference of all 12 built-in validation guards shipped with defense-in-depth.**

---

## Catalog Overview

| Guard Name | Guard ID | Tier | Default Severity | Config Key |
| :--- | :--- | :--- | :--- | :--- |
| **Hollow Artifact Detector** | `hollowArtifact` | Tier 0 | `BLOCK` | `guards.hollowArtifact` |
| **SSoT Pollution Detector** | `ssotPollution` | Tier 0 | `BLOCK` | `guards.ssotPollution` |
| **Root Pollution Guard** | `rootPollution` | Tier 0 | `BLOCK` | `guards.rootPollution` |
| **Commit Format Enforcer** | `commitFormat` | Tier 0 | `BLOCK` | `guards.commitFormat` |
| **Branch Naming Enforcer** | `branchNaming` | Tier 0 | `BLOCK` | `guards.branchNaming` |
| **Phase Gate Guard** | `phaseGate` | Tier 0 | `BLOCK` | `guards.phaseGate` |
| **Ticket Identity Guard** | `ticketIdentity` | Tier 0 | `WARN` | `guards.ticketIdentity` |
| **HITL Review Enforcer** | `hitlReview` | Tier 0 | `BLOCK` (opt-in) | `guards.hitlReview` |
| **Federation Governance Guard** | `federation` | Tier 0 | `WARN` | `guards.federation` |
| **Secret Detection Guard** | `secretDetection` | Tier 0 | `BLOCK` | `guards.secretDetection` |
| **File Size Limit Guard** | `fileSizeLimit` | Tier 0 | `BLOCK` | `guards.fileSizeLimit` |
| **Dependency Audit Guard** | `dependencyAudit` | Tier 1 | `BLOCK` (opt-in) | `guards.dependencyAudit` |

---

## Guard Specifications

### 1. `hollowArtifactGuard`
- **Purpose**: Prevents incomplete stubs or unfinished draft markers from reaching Git history.
- **Scanned Extensions**: `.md`, `.json`, `.yml`, `.yaml`.
- **Default Action**: Fails if matched against draft tokens or if artifact length is under `minContentLength`.

### 2. `secretDetectionGuard`
- **Purpose**: Scans staged files for high-confidence secrets (AWS keys, GitHub PATs, OpenAI/Anthropic keys, Stripe API keys, Private Key PEM blocks).
- **Redaction**: Findings mask sensitive credential material for leak safety.

### 3. `fileSizeLimitGuard`
- **Purpose**: Blocks large binaries and dump files from cluttering the Git object database (default threshold 1 MB).
- **Remediation**: Recommends configuring Git LFS and `.gitignore`.

### 4. `dependencyAuditGuard`
- **Purpose**: Runs `npm audit --json` on dependency updates to catch known CVEs before commit.
- **Degradation**: Gracefully yields `WARN` without blocking if network or npm is offline.
