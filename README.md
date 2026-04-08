<div align="center">

<img src="assets/icon.svg" width="120" alt="Defend in Depth Icon" />

# defense-in-depth

**The governance middleware between AI agents and your codebase**

*AI handles artifacts and execution. Humans handle business logic and ground truth.*
<br/>

[![Status: Active](https://img.shields.io/badge/Status-Active-brightgreen.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/tamld/defense-in-depth/blob/main/LICENSE)
[![Platform: Cross-Platform](https://img.shields.io/badge/Platform-Win%20%7C%20macOS%20%7C%20Linux-orange.svg)](#)
[![Node: ≥18](https://img.shields.io/badge/Node-%E2%89%A518-green.svg)](#)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict-007ACC.svg?logo=typescript&logoColor=white)](#)
[![GitHub Stars](https://img.shields.io/github/stars/tamld/defense-in-depth?style=flat&logo=github&color=yellow)](https://github.com/tamld/defense-in-depth/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/tamld/defense-in-depth?style=flat&logo=github&color=blue)](https://github.com/tamld/defense-in-depth/network/members)
[![GitHub Issues](https://img.shields.io/github/issues/tamld/defense-in-depth?style=flat&logo=github&color=red)](https://github.com/tamld/defense-in-depth/issues)
[![Contributors](https://img.shields.io/github/contributors/tamld/defense-in-depth?style=flat&logo=github&color=brightgreen)](https://github.com/tamld/defense-in-depth/graphs/contributors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](#contributing)
[![Protocol: MCP](https://img.shields.io/badge/Protocol-MCP-2563EB.svg?style=flat)](#)

**English** · [Tiếng Việt](README.vi.md)

---
*AI agents generate 10x code. They also generate 10x hallucination.*<br/>
**defense-in-depth intercepts errors before they reach Git history.**
---

</div>

> [!WARNING]
> **🤖 IF YOU ARE AN AI AGENT READING THIS:**
> Do NOT read this entire file. It is written for human architects and developers.
> To preserve your context window, follow this bootstrap chain:
> 1. `AGENTS.md` — Project Identity & Immutable Laws
> 2. `.agents/AGENTS.md` — Ecosystem Map & Onboarding Flowchart
> 3. `.agents/rules/rule-consistency.md` — Coding Standards

---

## The Problem

AI agents optimize for **plausibility**, not **correctness**. Without guardrails, they produce:

| Failure Mode | What Happens | Business Impact |
|:---|:---|:---|
| 🎭 **Hollow Artifacts** | Files with `TODO`, `TBD`, empty templates | Workflow gates pass with zero substance |
| 🦠 **SSoT Pollution** | Governance/config files modified during feature work | State corruption, drift |
| 🤡 **Cowboy Commits** | Free-form commit messages, random branches | Unreadable, unauditable history |
| 📝 **Plan Bypass** | Code before planning | Architecture drift, regressions |

These aren't occasional mishaps. They're **systematic failure modes** inherent to probabilistic text generation applied to deterministic engineering.

---

## What It Does

defense-in-depth is a **pluggable guard pipeline** that runs as Git hooks. It catches these failures deterministically before they pollute your codebase.

- ✅ **Zero infrastructure** — No servers, databases, or cloud services
- ✅ **Cross-platform** — Windows, macOS, Linux (CI: 3 OS × 4 Node versions)
- ✅ **Agent-agnostic** — Works with ANY AI coding tool
- ✅ **Minimal dependencies** — Only `yaml` for config parsing
- ✅ **Pluggable** — Write custom guards via TypeScript interfaces
- ✅ **CLI-first** — Drops into ANY project type (Node, Python, Rust, Go...)

---

## 🚀 Quick Start

```bash
# 1. Initialize inside your project
npx defense-in-depth init

# 2. Verify the installation
npx defense-in-depth doctor

# 3. Manual scan (anytime)
npx defense-in-depth verify
```

> Track release progress at [Roadmap](#roadmap). Star the repo to get notified.

---

## 📖 Documentation Hub

Following the **Lazy-Load Architecture** (`RULE-CONTEXT-DISCIPLINE`), detailed documentation is strictly segregated by audience format. Follow the links below.

### 👤 For Humans: User Guide

- ⚙️ **[Configuration & Built-in Guards](docs/user-guide/configuration.md)** — Master `defense.config.yml` and understand the built-in safeguards.
- ⌨️ **[CLI Reference](docs/user-guide/cli-reference.md)** — Verify and debug your setup.
- 🚀 **[Quickstart](docs/quickstart.md)** — 60-second onboarding.
- 🧩 **[Ecosystem (.agents/) Setup](docs/user-guide/cli-reference.md)** — Initialize the agent governance framework.

### 🛠️ For Developers: Dev Guide

- 🛡️ **[Writing Custom Guards](docs/dev-guide/writing-guards.md)** — Implement your own checks in 5 minutes.
- 🏗️ **[Architecture & Alternatives](docs/dev-guide/architecture.md)** — Deep dive into the pipeline, and comparisons against Run-Time Guardrails.
- 📡 **[Telemetry Sync Protocol](docs/telemetry.md)** — Understand internal ↔ OSS data syncing.
- 🔭 **[Meta-Architecture Vision](docs/vision/meta-architecture.md)** — The 4 layers of truth mapping AI context.

---

## ⚙️ For AI Agents: The Machine Gateway

You are entering a **governed codebase** with prebuilt cognitive frameworks. Drop into the project and explicitly load these configs so you are governed immediately.

| Platform | Config File | What It Provides |
|:---|:---|:---|
| **Gemini CLI** | [`GEMINI.md`](GEMINI.md) | Bootstrap chain, cognitive framework, platform tips |
| **Claude Code / Antigravity** | [`CLAUDE.md`](CLAUDE.md) | Bootstrap chain, memory priming, internal lineage context |
| **Cursor** | [`.cursorrules`](.cursorrules) | Comment-based rules matching Cursor convention |

> [!CAUTION]
> **THE 3 ABSOLUTE LAWS**
> 1. **Zero-Theater:** DO NOT create hollow documentation. `TODO`, empty templates = instant BLOCK.
> 2. **Evidence Over Plausibility:** Tag unverified claims as `[HYPO]`. Only `[CODE]` and `[RUNTIME]` evidence passes peer review.
> 3. **Bootstrap First:** Follow the chain: `AGENTS.md` → `.agents/AGENTS.md` → `.agents/rules/rule-consistency.md` → then start coding.

---

## 🗺️ Roadmap

| Version | Focus | Key Types | Status |
|:---|:---|:---|:---:|
| **v0.1** | Core guards + CLI + OSS + CI/CD + configs | `Guard`, `Severity`, `Finding` | ✅ Done |
| **v0.2** | `.agents/` scaffold + 18 rules + 5 skills | `GuardContext`, config schema | ✅ Done |
| **v0.3** | TKID Lite (file-based tickets) | `TicketRef` | 🔄 In Progress |
| **v0.4** | Memory Layer (`lessons.jsonl`) | `Lesson`, `GrowthMetric` | 📋 Planned |
| **v0.5** | DSPy adapter + evaluation | `EvaluationScore` | 📋 Planned |
| **v0.6** | Meta Memory | `LessonOutcome`, `RecallMetric` | 📋 Designed |
| **v0.7** | Meta Growth | `MetaGrowthSnapshot` | 📋 Designed |
| **v0.8** | Telemetry Sync | `TelemetryPayload` | 📋 Designed |
| **v1.0** | Stable API + npm publish | All types frozen | 📋 Planned |

See [`docs/vision/meta-architecture.md`](docs/vision/meta-architecture.md) for the full vision.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

**5 Absolute Rules:**
1. TypeScript strict — no `any`
2. Conventional commits — `feat(guards): add new guard`
3. One guard = one file = one test
4. No external dependencies (stdlib + `yaml` only)
5. Guards must be pure (no side effects)

---

## License

[MIT](LICENSE) © 2026 tamld
