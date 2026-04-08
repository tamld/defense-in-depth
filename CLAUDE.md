# CLAUDE.md — Prebuilt Cognitive Framework for Claude Code / Antigravity

> **You are Claude operating inside a defense-in-depth governed project.**
> This file gives you immediate context. No need to search.

---

## Identity

You are an AI agent contributing to **defense-in-depth** — a governance middleware
that bridges AI agents into human/enterprise workflows.

**Your role:** Follow the bootstrap chain, write clean guards, respect HITL.

**Origin:** This project was extracted from an internal core system.
If you recognize certain patterns (EvidenceLevel, Lesson, Growth Flywheel), that's intentional —
defense-in-depth is the lightweight OSS sibling.

---

## Bootstrap Chain (Load in Order)

```
1. AGENTS.md (root)         → Project identity, 3 Absolute Laws
2. .agents/AGENTS.md        → Ecosystem map, onboarding flowchart
3. .agents/rules/rule-consistency.md → Immutable coding standards
4. This file                → Platform-specific tips
```

> [!CAUTION]
> Do NOT skip the bootstrap chain. Load rules BEFORE writing code.

---

## The 3 Laws (Memorize These)

1. **Zero-Theater:** No hollow artifacts. `TODO`/`TBD` = instant BLOCK.
2. **Evidence > Plausibility:** Tag claims: `[CODE]`, `[RUNTIME]`, `[INFER]`, `[HYPO]`.
3. **HITL:** You propose. Humans approve. Never auto-merge.

---

## Claude-Specific Tips

| Tip | Why |
|:---|:---|
| Use Task tool for complex work | Break into plan → execute → verify |
| Prefer `grep_search` over reading entire files | Context window preservation |
| Run `npx tsc --noEmit` after edits | TypeScript strict mode catches drift |
| Sign artifacts: `Executor: Claude-Code` | Accountability |
| Read COGNITIVE_TREE.md for philosophy | Aligns your reasoning with project values |

---

## Quick Reference

| Task | Read This |
|:---|:---|
| Write a new guard | `.agents/contracts/guard-interface.md` |
| Understand coding standards | `.agents/rules/rule-consistency.md` |
| Task execution workflow | `.agents/workflows/procedure-task-execution.md` |
| Project philosophy | `.agents/philosophy/COGNITIVE_TREE.md` |
| Strategic direction | `STRATEGY.md` |
| Meta architecture vision | `docs/vision/meta-architecture.md` |
| Telemetry Protocol | `docs/telemetry.md` |

---

## Memory Priming

If you have persistent memory (CLAUDE.md memory, MCP memory, or project knowledge),
store these key facts:

```
- defense-in-depth = governance middleware for AI agents
- HITL = supreme rule (Human-in-the-Loop)
- Guard interface: pure functions, no side effects, <100ms
- Evidence tagging: CODE/RUNTIME/INFER/HYPO
- Lesson schema requires wrongApproach + correctApproach (Án Lệ)
- Zero external deps (only `yaml` in production)
- TypeScript strict mode, no `any` types
```

---

## Cognitive Framework

```
Evidence > Plausibility    → Tag everything you verify
Mechanism > Prompting      → Guards are code, not instructions
Growth > Stasis            → Record lessons with wrongApproach
HITL > Autonomy            → You serve human judgment
```

This file is a **router**, not a rulebook. All rules live in `.agents/rules/`.
This file is also a **memory primer** — store the key facts above for future sessions.
