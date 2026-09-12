# Migration Guide — v0.1.0 → v1.0.0

> **TL;DR** — v1.0 is a stabilisation release, not a redesign. If your `defense.config.yml` declares `version: "1"` and you only consume the public surface (no `dist/...` deep imports), upgrading is a one-line bump in `package.json`.

---

## 1. What v1.0 Is

v1.0 freezes the public surface that has been incrementally landing since v0.2:

| Surface | Frozen by v1.0 | Where to read it |
|:---|:---|:---|
| Library entry point | Every value- and type-level export from [`src/index.ts`](src/index.ts) | [SEMVER.md](SEMVER.md) |
| Guard / Provider contract | `Guard`, `GuardContext`, `GuardResult`, `Finding`, `Severity`, `EvidenceLevel`, `EngineVerdict`, `TicketStateProvider` | [src/core/types.ts](src/core/types.ts) · [.agents/contracts/guard-interface.md](.agents/contracts/guard-interface.md) |
| Configuration schema | `DefendConfig` (the `defense.config.yml` shape), required `version: "1"` field | [Configuration Guide](docs/user-guide/configuration.md) |
| CLI surface | `init`, `verify`, `doctor`, `eval`, `feedback`, `lesson`, `growth` subcommands · exit codes `0/1/2` · WARN ≠ exit non-zero | [CLI Reference](docs/user-guide/cli-reference.md) |

---

## 2. Breaking Changes in v1.0

1. **`Severity` no longer re-exported from `src/core/engine.ts`**. Use `import { Severity } from "defense-in-depth"` instead.
2. **`defense.config.yml` requires `version: "1"`**. Add this at the top if missing.
3. **`loadConfig()` throws `ConfigError` on invalid configs** (previously warned and returned `DEFAULT_CONFIG`). The zero-config path is unchanged.

---

## 3. Features Added Since v0.1.0 (npm `latest`)

### 3.1 v0.2 — `.agents/` Ecosystem Scaffold
- `npx defense-in-depth init --scaffold` creates `.agents/` governance ecosystem

### 3.2 v0.3 — File-based Ticket Federation
- `ticketIdentity` guard (WARN, opt-in) — detects cross-ticket contamination via TKID regex
- `FileTicketProvider` — reads `TICKET.md` YAML frontmatter; zero infrastructure

### 3.3 v0.4 — Memory Layer (Án Lệ)
- `lessons.jsonl` — local case-law store
- `did lesson` CLI — record/search lessons (`wrongApproach` + `correctApproach`)
- `did growth` CLI — record `GrowthMetric` to `growth_metrics.jsonl`

### 3.4 v0.5 — Optional DSPy Semantic Layer
- `hollowArtifact.useDspy` opt-in — semantic scoring augments deterministic checks
- `did eval` CLI — standalone artifact quality analysis
- DSPy never BLOCKs; only raises WARN; failures degrade silently

### 3.5 v0.6 — Federation Guards
- `federationGuard` — pure cross-validation of child vs parent ticket phase
- `HttpTicketProvider` — `globalThis.fetch` with timeout; non-fatal on failure

### 3.6 v0.7 — Progressive Discovery (Path A)
- `did feedback` — label guard findings as TP/FP/FN/TN
- `did lesson outcome` — record explicit recall helpfulness
- `did lesson scan-outcomes` — implicit re-occurrence detection via `wrongApproachPattern`
- Hint engine (`did doctor --hints`) — 4 rules, 7-day cooldown, earned-trigger only

### 3.7 v0.8 — Linear & Jira Providers
- `linear` provider — Linear (linear.app) GraphQL API
- `jira` provider — Jira REST API with status→phase mapping
- Both support `ticketIdentity` and `federation` guards

---

## 4. Upgrade Steps

```bash
# 1. Update package.json
npm install defense-in-depth@1.0.0-rc.1

# 2. Ensure defense.config.yml has version: "1"
# (already required since v0.1.0)

# 3. Run verify to confirm
npx defense-in-depth verify

# 4. Optional: regenerate scaffold
npx defense-in-depth init --scaffold --force
```

---

## 5. Config Schema Changes

| Path | v0.1.0 | v1.0.0 | Action |
|:---|:---|:---|:---|
| `guards.ticketIdentity` | ❌ | ✅ (opt-in) | Add if using ticket federation |
| `guards.federation` | ❌ | ✅ (opt-in) | Add for parent/child repo governance |
| `guards.hollowArtifact.useDspy` | ❌ | ✅ (opt-in) | Add for semantic evaluation |
| `hints` | ❌ | ✅ (opt-in) | Add for Progressive Discovery |
| `version` | `"1"` | `"1"` | No change required |

---

## 6. New CLI Commands

| Command | Purpose |
|:---|:---|
| `did eval` | Semantic artifact quality analysis |
| `did feedback` | Label guard findings (TP/FP/FN/TN) |
| `did lesson outcome` | Record lesson recall helpfulness |
| `did lesson scan-outcomes` | Detect implicit lesson re-occurrences |
| `did growth` | Record growth metrics |
| `did doctor --hints` | Show/hide Progressive Discovery hints |

---

## 7. Public API Surface (Frozen)

```typescript
// Library entry point
export * from "./core/types.js";
export * from "./core/engine.js";
export * from "./core/errors.js";
export * from "./federation/index.js";
export { createProvider } from "./federation/index.js";
```

**Frozen for 90 days minimum.** Internal classes / private utilities NOT frozen.

---

## 7. Rollback

If issues arise:
```bash
npm install defense-in-depth@0.1.0
```
No config migration needed — v0.1.0 config is valid for v1.0.
