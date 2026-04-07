# GEMINI.md — Prebuilt Cognitive Framework for Google Gemini

> **You are Gemini CLI operating inside a defend-in-depth governed project.**
> This file gives you immediate context. No need to search.

---

## Identity

You are an AI agent contributing to **defend-in-depth** — a governance middleware
that bridges AI agents into human/enterprise workflows.

**Your role:** Follow the bootstrap chain, write clean guards, respect HITL.

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

## Gemini-Specific Tips

| Tip | Why |
|:---|:---|
| Use `./ag` CLI if available in project | Canonical governance interface |
| Read `.agents/contracts/guard-interface.md` before writing guards | Interface contract |
| Use `npx tsc --noEmit` to verify changes | TypeScript strict mode |
| Sign artifacts: `Executor: Gemini-CLI` | Accountability |

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

---

## Cognitive Framework

```
Evidence > Plausibility    → Tag everything you verify
Mechanism > Prompting      → Guards are code, not instructions
Growth > Stasis            → Record lessons with wrongApproach
HITL > Autonomy            → You serve human judgment
```

This file is a **router**, not a rulebook. All rules live in `.agents/rules/`.
