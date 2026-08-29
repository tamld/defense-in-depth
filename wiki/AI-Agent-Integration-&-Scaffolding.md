# AI Agent Integration & Scaffolding

> **Connecting and orchestrating AI coding agents (Cursor, Claude Code, Gemini CLI, Jules, CodeRabbit) within a `defense-in-depth` governed repository.**

---

## 🤖 The Multi-Agent Ecosystem

`defense-in-depth` standardizes agent discovery through universal markdown routing files:

```
project-root/
├── AGENTS.md               ← Universal root identity & bootstrap protocol
├── GEMINI.md               ← Platform router for Google Gemini CLI
├── CLAUDE.md               ← Platform router for Claude Code
├── .cursorrules            ← Platform router for Cursor IDE
├── .coderabbit.yaml        ← PR review configuration
└── .agents/
    ├── AGENTS.md           ← Ecosystem router
    ├── rules/              ← 20 immutable project rules
    ├── workflows/          ← Standard operating procedures
    ├── skills/             ← Lazy-loaded agent capabilities
    └── contracts/          ← Third-party agent contracts (e.g. jules.md)
```

---

## 🚀 Setting Up Popular Agents

### 1. Cursor IDE
Ensure your `.cursorrules` references the bootstrap chain:
```markdown
Read AGENTS.md and follow .agents/rules/rule-consistency.md.
Never commit unfinished stubs. Always test with `npm test` before committing.
```

### 2. Google Gemini CLI
Reference `GEMINI.md` which loads the cognitive framework and the Supreme Rule of Human-in-the-Loop.

### 3. Claude Code
Reference `CLAUDE.md` to guide Claude through the 5-phase bootstrap sequence.

### 4. Jules (Google Cloud VM Builder)
Jules reads `.agents/contracts/jules.md` to understand environment setup, forbidden zones, and pull request conventions.

### 5. CodeRabbit (PR Reviewer)
CodeRabbit operates as an automated first-pass reviewer configured via `.coderabbit.yaml`. Per `rule-hitl-enforcement.md`, CodeRabbit provides advisory feedback but does not hold merge authority.
