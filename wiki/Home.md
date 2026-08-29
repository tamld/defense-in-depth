# Welcome to the defense-in-depth Wiki

> **defense-in-depth** is the Git-based governance middleware for AI coding agents.  
> It prevents AI hallucination, hollow artifacts, and governance pollution deterministically before code reaches Git history.

---

## 🌟 Core Philosophy

- **Mechanism over Prompting**: System prompt instructions are probabilistic; Git-level guardrails are deterministic.
- **Evidence > Plausibility**: Every finding and decision must carry verifiable evidence (`[CODE]`, `[RUNTIME]`, `[INFER]`, `[HYPO]`).
- **Human-in-the-Loop (Supreme Rule)**: AI agents generate code and collect artifacts. Humans maintain sovereign authority over business logic, ground truth, and architectural direction.
- **Progressive Enhancement**: Tier 0 deterministic core works with zero dependencies; Tier 1 intelligence compounds without making external services mandatory.

---

## 🗺️ Wiki Navigation

| Section | Description |
|:---|:---|
| 🚀 **[Getting Started](Getting-Started)** | 60-second onboarding, initializing hooks, and CI/CD setup |
| 🏗️ **[Core Architecture](Core-Architecture)** | 3-Tier layering model, engine pipeline, and Git hook lifecycle |
| 🛡️ **[Built-in Guards Catalog](Built-in-Guards-Catalog)** | Complete reference for all 9 built-in deterministic guards |
| 💻 **[CLI Reference & Tooling](CLI-Reference-&-Tooling)** | Full CLI command manual for `init`, `verify`, `doctor`, `lesson`, `feedback` |
| 🛠️ **[Custom Guards & Plugins](Custom-Guards-&-Plugins)** | Step-by-step guide to authoring and testing custom pure guards |
| 🌐 **[Federation & Cross-Repo](Federation-&-Cross-Repo-Governance)** | Managing parent-child ticket states across federated repositories |
| 🧠 **[Memory & Án Lệ System](Memory-&-Án-Lệ-System)** | Cognitive memory loops, JSONL stores, and progressive hints |
| 🤖 **[AI Agent Integration](AI-Agent-Integration-&-Scaffolding)** | Scaffolding `.agents/` for Cursor, Claude Code, Gemini CLI, Jules, and CodeRabbit |
| ❓ **[FAQ & Troubleshooting](FAQ-&-Troubleshooting)** | Diagnosing failures, handling emergency bypasses, and common questions |

---

## 🔗 Quick Links

- [GitHub Repository](https://github.com/tamld/defense-in-depth)
- [Issue Tracker](https://github.com/tamld/defense-in-depth/issues)
- [NPM Package](https://www.npmjs.com/package/defense-in-depth)
