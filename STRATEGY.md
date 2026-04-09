# 📋 STRATEGY.md — Strategic Metadata for defense-in-depth

> **For any agent reading this:** This document tells you WHERE this project is going,
> WHAT has been decided, and HOW to contribute without conflicting with the plan.

---

## Mission

*For the complete philosophical foundation — the three cognitive branches, the DO/DON'T mandates, and the growth flywheel — see [COGNITIVE_TREE.md](.agents/philosophy/COGNITIVE_TREE.md).*

**defense-in-depth** is a governance middleware layer that bridges AI coding agents
into human/enterprise operational workflows.

- **AI** handles: artifact generation, execution plans, mechanical checks
- **Humans** handle: business logic, ground truth, architecture decisions
- **defense-in-depth** handles: the gap between them (validation, enforcement, growth)

---

## Strategic Pillars

### 1. CLI-First, Zero-Infrastructure (Depends-On Philosophy)

| Decision | Rationale |
|:---|:---|
| Git hooks only | No servers, databases, or cloud services required by default |
| `yaml` and `json` interfaces | Minimal attack surface, maximum portability |
| Cross-platform CI (3 OS × 3 Node) | Must work everywhere agents work |
| Pluggable Providers | Bridging to external systems (Jira, Linear) works via adapters, never bloated core |

**Implication for agents:** Do NOT introduce external dependencies. If a feature
requires infrastructure, it must be opt-in via a `TicketStateProvider` or similar extension, keeping the core lightweight.

### 2. Guard Pipeline Architecture

| Decision | Rationale |
|:---|:---|
| Pluggable `Guard` interface | Users can add custom validators |
| Pure functions only | No side effects → deterministic, testable |
| Engine runs guards sequentially | Predictable order, clear error attribution |
| PASS/WARN/BLOCK severity | Simple tri-state for clear decisions |

**Implication for agents:** Every new check = new guard file. No checking logic
inside the engine or CLI.

### 3. Trust-but-Verify (Evidence System)

| Decision | Rationale |
|:---|:---|
| `EvidenceLevel` enum (`CODE`/`RUNTIME`/`INFER`/`HYPO`) | Forces agents to tag how they verified |
| `Finding.evidence` field | Guards can attach proof level |
| Future: `Lesson.wrongApproach` + `correctApproach` | Án Lệ (case law) records concrete context |

**Implication for agents:** When reporting findings, ALWAYS specify evidence level.
Untagged findings are treated as `HYPO`.

### 4. HITL as Supreme Rule

| Decision | Rationale |
|:---|:---|
| Guards never auto-merge PRs | Human judgment is irreplaceable for semantics |
| Automated Gateways as first-pass reviewer | Reduces human review burden, not replaces it |
| Phase gates require plan files | Prevents "code first, think later" |

**Implication for agents:** You are NOT autonomous. You propose. Humans approve.
*For automated first-pass reviews, refer to internal operational rules like [rule-coderabbit-integration.md](.agents/rules/rule-coderabbit-integration.md) to handle feedback metadata.*

### 5. Growth Engine (Future)

| Decision | Rationale |
|:---|:---|
| `Lesson` type with recall-friendly fields | Growth requires searchable memory |
| `searchTerms` + `tags` + `relatedLessons` | Enables semantic recall across projects |
| `GrowthMetric` tracking | Measures learning velocity over time |
| `wrongApproach` is MANDATORY in lessons | Generic lessons are useless |

**Implication for agents:** When recording lessons, be SPECIFIC. "Always test code"
is rejected. "Guard X missed BOM-prefixed files because regex lacked BOM strip" is accepted.

### 6. Prebuilt Agent Configs (Meta Prompting Materialized)

| File | Platform | Purpose |
|:---|:---|:---|
| `GEMINI.md` | Gemini CLI | Bootstrap chain + cognitive framework |
| `CLAUDE.md` | Claude Code / Antigravity | Bootstrap chain + memory priming |
| `.cursorrules` | Cursor AI | Comment-based ruleset |

**Implication:** Any AI agent entering this project has ZERO onboarding friction.
They immediately receive: laws, coding standards, quick reference, and cognitive framework.
This is meta-prompting — not telling agents what to do, but teaching them how to teach themselves.

### 7. Meta Layers (Vision — Published as Types)

| Layer | Type | What it measures |
|:---|:---|:---|
| 0: Guards | `Guard`, `Finding` | Is this commit clean? (SHIPPED) |
| 1: Memory | `Lesson`, `GrowthMetric` | What did we learn? (DESIGNED) |
| 2: Meta Memory | `LessonOutcome`, `RecallMetric` | Are lessons recalled and helpful? |
| 3: Meta Growth | `MetaGrowthSnapshot` | Is the growth system improving? |
| F: Federation | `TelemetryPayload` | Bidirectional Internal ↔ OSS data flow |

All types are published in `src/core/types.ts` — compiled, documented, importable.
See `docs/vision/meta-architecture.md` for the full vision.

---

## Roadmap (Tactical)

| Phase | Version | Focus | Key Types |
|:---|:---:|:---|:---|
| **Foundation** | v0.1 | Core guards + CLI + OSS + prebuilt configs | `Guard`, `Severity`, `Finding` |
| **Ecosystem** | v0.2 | `.agents/` scaffold + 19 rules + 5 skills | `GuardContext`, config schema |
| **Identity** | v0.3 | Ticket-aware guards (TKID Lite) | `TicketRef` |
| **Memory** | v0.4 | Lesson recording + growth metrics | `Lesson`, `GrowthMetric` |
| **Intelligence** | v0.5 | DSPy adapter + semantic evaluation | `EvaluationScore` |
| **Meta Memory** | v0.6 | Recall quality measurement | `LessonOutcome`, `RecallMetric` |
| **Meta Growth** | v0.7 | Growth acceleration tracking | `MetaGrowthSnapshot` |
| **Telemetry Sync** | v0.8 | Bidirectional Internal ↔ OSS data flow | `TelemetryPayload` |
| **Stable** | v1.0 | Public API freeze + npm publish | All types frozen |

**Status Update (v0.4)**: Foundation (v0.1), Ecosystem (v0.2), Identity (v0.3) shipped. Memory Layer & Root Pollution Guard (v0.4) **in progress**:

- `TicketRef` added to `GuardContext` — engine extracts TKID from branch name, commit message, or directory name.
- `TicketIdentityGuard` enforces non-contradiction: if branch declares TKID `TK-xxx`, commit must not reference a *different* ticket. Severity: `WARN` (advisory, not blocking).
- **Key architectural insight**: Git worktree IS the Dependency Injection mechanism. `DefendEngine(projectRoot)` receives CWD as the scope boundary. All git operations (`branch`, `staged files`, `config`) resolve relative to this root. When an AAOS worktree (`.worktrees/TK-xxx/`) is the CWD, identity and isolation come free from Git. When a standalone project is the CWD, the same code works without modification. **Zero lock-in by design.**
- **Lesson**: `.worktrees` path was initially hardcoded in `extractTicketRef` — removed. Branch name is the canonical TKID source; directory name is a generic fallback.
- **Review Ecosystem Enhancement**: End-user Gateway profiles should align with AAOS guidelines, integrating assertive architectural analysis and preserving the Git-ignored `.agents/records/reviews/` flow.

Each phase builds on the previous. Agents MUST NOT implement v0.4 features during v0.3 work unless explicitly tasked.

---


