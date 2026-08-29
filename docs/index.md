# Documentation Index — defense-in-depth

> **Master navigation index for human developers, architects, and AI agents.**  
> *Follow the Lazy-Load Principle: Load only what your current mission requires.*

---

## 🧭 When to Read What (Mission Matrix)

| Your Mission | Recommended Document | Read Time |
|:---|:---|:---:|
| **60-Second Quickstart & Install** | [`quickstart.md`](quickstart.md) | 2 min |
| **Configuring Guards & Rules** | [`user-guide/configuration.md`](user-guide/configuration.md) | 5 min |
| **CLI Commands Reference** | [`user-guide/cli-reference.md`](user-guide/cli-reference.md) | 3 min |
| **Federation & Ticket Providers** | [`user-guide/providers.md`](user-guide/providers.md) | 5 min |
| **Progressive Discovery Hints** | [`user-guide/hints.md`](user-guide/hints.md) | 5 min |
| **Core Architecture & Engine** | [`dev-guide/architecture.md`](dev-guide/architecture.md) | 8 min |
| **Authoring a Custom Guard** | [`dev-guide/writing-guards.md`](dev-guide/writing-guards.md) | 10 min |
| **Custom Guard Plugin Guide** | [`dev-guide/custom-guards.md`](dev-guide/custom-guards.md) | 8 min |
| **API Reference & Catalog** | [`api/index.md`](api/index.md) | 5 min |
| **Authoring a Custom Provider** | [`dev-guide/writing-providers.md`](dev-guide/writing-providers.md) | 8 min |
| **Connecting DSPy Inference** | [`dev-guide/dspy-providers.md`](dev-guide/dspy-providers.md) | 8 min |
| **Engine Execution & Fail-Fast Policy** | [`dev-guide/fail-fast-policy.md`](dev-guide/fail-fast-policy.md) | 5 min |
| **Test Quality & Adversarial Testing** | [`dev-guide/test-quality-checklist.md`](dev-guide/test-quality-checklist.md) | 5 min |
| **Agent Workspace Guidelines** | [`ecosystem/agent-workspace-guidelines.md`](ecosystem/agent-workspace-guidelines.md) | 4 min |
| **Multi-Agent Coordination (Jules/Claude/Cursor)** | [`ecosystem/ai-agent-coordination.md`](ecosystem/ai-agent-coordination.md) | 6 min |
| **Guard Contract Interface** | [`agents/guard-interface.md`](agents/guard-interface.md) | 4 min |
| **Provider Contract Interface** | [`agents/provider-interface.md`](agents/provider-interface.md) | 4 min |
| **Semantic Versioning Contract** | [`SEMVER.md`](SEMVER.md) | 6 min |
| **Migration Guide (v0.x → v1.0)** | [`migration/v0-to-v1.md`](migration/v0-to-v1.md) | 10 min |
| **Threat Model & Security Policy** | [`../SECURITY.md`](../SECURITY.md) | 8 min |
| **Meta-Architecture & Án Lệ Memory** | [`vision/meta-architecture.md`](vision/meta-architecture.md) | 12 min |
| **Unified System Blueprint** | [`vision/system-blueprint.md`](vision/system-blueprint.md) | 10 min |
| **Strategic Direction & Pillars** | [`../STRATEGY.md`](../STRATEGY.md) | 12 min |
| **Agent Skills Discovery Index** | [`../.agents/skills/AGENTS.md`](../.agents/skills/AGENTS.md) | 3 min |

---

## 🏛️ The 5 Pillars of Documentation

```
docs/
├── 1. Getting Started     → quickstart.md, SEMVER.md, migration/v0-to-v1.md
├── 2. User Guide          → configuration.md, cli-reference.md, providers.md, hints.md
├── 3. Developer Guide     → architecture.md, writing-guards.md, writing-providers.md, dspy-providers.md, ...
├── 4. Ecosystem           → agent-workspace-guidelines.md, ai-agent-coordination.md, contracts/
└── 5. Vision & Roadmap    → meta-architecture.md, system-blueprint.md, meta-growth-roadmap.md
```

### Pillar 1: Getting Started
- [`quickstart.md`](quickstart.md) — 60-second onboarding, initializing hooks, doctor verification, and GitHub Action setup.
- [`SEMVER.md`](SEMVER.md) — Public API surface inventory, breaking change definitions, deprecation policy, and release channels.
- [`migration/v0-to-v1.md`](migration/v0-to-v1.md) — Step-by-step upgrade guide from early versions to v1.0.

### Pillar 2: User Guide (`docs/user-guide/`)
- [`user-guide/configuration.md`](user-guide/configuration.md) — Full `defense.config.yml` schema, default values, and deep-merge rules.
- [`user-guide/cli-reference.md`](user-guide/cli-reference.md) — Complete manual for `init`, `verify`, `doctor`, `feedback`, `eval`, `growth`, `hints-emit`, and `lesson`.
- [`user-guide/providers.md`](user-guide/providers.md) — Configuring File and HTTP ticket providers for cross-repository federation.
- [`user-guide/hints.md`](user-guide/hints.md) — Progressive discovery hints engine and developer context feedback.

### Pillar 3: Developer Guide (`docs/dev-guide/`)
- [`dev-guide/architecture.md`](dev-guide/architecture.md) — Engine pipeline, Guard interface, Severity levels, and execution flow.
- [`dev-guide/writing-guards.md`](dev-guide/writing-guards.md) — Canonical guide for authoring pure, deterministic guards.
- [`dev-guide/writing-providers.md`](dev-guide/writing-providers.md) — How to implement and contract-test custom ticket providers.
- [`dev-guide/dspy-providers.md`](dev-guide/dspy-providers.md) — Integrating local/cloud LLMs (Ollama, Groq, OpenRouter, Gemini) for Tier 1 DSPy evaluation.
- [`dev-guide/fail-fast-policy.md`](dev-guide/fail-fast-policy.md) — Behavior of `collect-all` vs `fail-fast` modes during gate execution.
- [`dev-guide/test-quality-checklist.md`](dev-guide/test-quality-checklist.md) — Adversarial test coverage standards and bypass resistance.

### Pillar 4: Ecosystem & Multi-Agent Governance (`docs/ecosystem/`)
- [`ecosystem/agent-workspace-guidelines.md`](ecosystem/agent-workspace-guidelines.md) — Physical file boundaries, anti-pollution rules, and scratch directory conventions.
- [`ecosystem/ai-agent-coordination.md`](ecosystem/ai-agent-coordination.md) — Multi-agent roles (Gemini, Claude, Cursor, Jules, CodeRabbit) and handoff protocols.
- [`agents/guard-interface.md`](agents/guard-interface.md) — Formal Guard interface contract.
- [`agents/provider-interface.md`](agents/provider-interface.md) — Formal Provider interface contract.

### Pillar 5: Vision & Roadmap (`docs/vision/`)
- [`vision/meta-architecture.md`](vision/meta-architecture.md) — 5-layer meta-memory model, Án Lệ (Case Law), and self-improving cognitive flywheel.
- [`vision/system-blueprint.md`](vision/system-blueprint.md) — Architectural taxonomy comparing deterministic Git hooks against dynamic runtime guardrails (NeMo, Guardrails AI).
- [`vision/meta-growth-roadmap.md`](vision/meta-growth-roadmap.md) — Track A (Adoption) and Track B (Meta Growth) milestone plans and gating criteria.
- [`vision/meta-growth-mvc.md`](vision/meta-growth-mvc.md) — Minimum Viable Cognition implementation notes.
- [`vision/meta-growth-design-notes.md`](vision/meta-growth-design-notes.md) — Deep architectural research and design journal.
- [`vision/rfc-v0.5-semantic-intelligence.md`](vision/rfc-v0.5-semantic-intelligence.md) — Historical RFC introducing Tier 1 semantic evaluation.

---

## 🤖 Lazy-Load Principle for AI Agents

> **Every document starts with a 3-line header stating its scope and target audience.**  
> AI agents MUST read the header first and abort reading if the document does not match the current task. This preserves context window efficiency and eliminates context rot.
