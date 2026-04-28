# Documentation Index — defense-in-depth

> **Navigation map for AI agents and human contributors.**
> Load only the document relevant to your current task.

---

## When to Read What

| Your task | Document | Read time |
|:---|:---|:---|
| Writing or registering a Guard | [dev-guide/writing-guards.md](dev-guide/writing-guards.md) | 10 min |
| Connecting a DSPy inference provider | [dev-guide/dspy-providers.md](dev-guide/dspy-providers.md) | 8 min |
| Understanding engine fail-fast behavior | [dev-guide/fail-fast-policy.md](dev-guide/fail-fast-policy.md) | 5 min |
| Understanding what counts as breaking | [SEMVER.md](SEMVER.md) | 8 min |
| Upgrading from v0.x to v1.0 | [migration/v0-to-v1.md](migration/v0-to-v1.md) | 12 min |
| Understanding the project's threat model | [../SECURITY.md](../SECURITY.md) | 10 min |
| Understanding long-term architecture | [vision/meta-architecture.md](vision/meta-architecture.md) | 15 min |
| Understanding philosophy and roadmap | [../STRATEGY.md](../STRATEGY.md) | 15 min |
| Loading an agent skill | [../.agents/skills/AGENTS.md](../.agents/skills/AGENTS.md) | 3 min |

---

## Document Map

### Developer Guides (`docs/dev-guide/`)

| File | Purpose |
|:---|:---|
| [dspy-providers.md](dev-guide/dspy-providers.md) | How to connect Ollama, Groq, NVIDIA NIM, OpenRouter, Gemini to the DSPy layer |
| [fail-fast-policy.md](dev-guide/fail-fast-policy.md) | Engine behavior: collect-all vs fail-fast, when BLOCK stops execution |
| `writing-guards.md` | *(planned v0.7)* Step-by-step guide to authoring a new Guard |

### Vision (`docs/vision/`)

| File | Purpose |
|:---|:---|
| [meta-architecture.md](vision/meta-architecture.md) | The 5-layer meta-memory model and long-term system vision |

### Stability Contract (`docs/`)

| File | Purpose |
|:---|:---|
| [SEMVER.md](SEMVER.md) | Public-surface inventory, Major/Minor/Patch decision rules, deprecation policy, pre-release channels |
| [migration/v0-to-v1.md](migration/v0-to-v1.md) | Upgrade guide for v0.1.0 → v1.0 (covers every feature shipped in v0.2 → v0.7-rc.1) |

### Project Root

| File | Purpose |
|:---|:---|
| [README.md](../README.md) | Installation, quick start, guard reference, roadmap |
| [STRATEGY.md](../STRATEGY.md) | Strategic pillars, architectural decisions, status updates |
| [SECURITY.md](../SECURITY.md) | Threat model, disclosure policy, attack surface |
| [CHANGELOG.md](../CHANGELOG.md) | Version history |

### Agent Configuration (`/.agents/`)

| File | Purpose |
|:---|:---|
| [.agents/skills/AGENTS.md](../.agents/skills/AGENTS.md) | Skill discovery index for AI agents |
| [.agents/rules/](../.agents/rules/) | Deterministic governance rules |
| [.agents/philosophy/COGNITIVE_TREE.md](../.agents/philosophy/COGNITIVE_TREE.md) | Cognitive framework for agents |

---

## Lazy-Load Principle

> Every document in this project starts with a 3-line header that tells you
> whether it's relevant to your task. Read the header first. Skip the file
> if it doesn't match your task.

This prevents agents from loading 300-line files to answer a 3-line question.
