# .agents/skills — Agent Skills for defense-in-depth

> **Read this when**: You are an AI agent contributing to this project and
> need to load specialized behavioral guidelines for your task.
>
> **Skip if**: You are a human developer — skills are behavioral guidelines
> for AI contributors, not developer documentation. See `docs/` instead.

---

## What are Skills?

Skills are **lazy-loaded behavioral specifications** for AI agents. They define
how an agent should approach a specific type of task, what constraints apply,
and what outputs are required.

Skills are **never** imported by TypeScript source code. They are read by AI
agents at task time — not by the runtime engine.

> **Why not AAOS captain skills?**
> Captain skills (epistemologist, socratic, planner...) are deeply coupled to the
> AAOS multi-agent platform and its orchestration vocabulary. They are not portable
> to Devin, Jules, CodeRabbit, or other external agents that work in this repo.
> DiD ships **specialist skills only** — domain-specific, self-contained, and
> usable by any AI agent without AAOS context.

---

## Skill Discovery

Load only the skill relevant to your current task. **Do not load all skills.**

```
Your task type                    → Load this skill
─────────────────────────────────────────────────────────────────────────
Writing or modifying a Guard      → skill-guard-governance/SKILL.md
Threat modeling a new check       → skill-threat-modeling-expert/SKILL.md
Writing adversarial tests         → skill-test-architect/SKILL.md
Code review of a PR               → skill-review-code/SKILL.md
Refactoring existing guard code   → skill-surgical-refactorer/SKILL.md
Mapping blast radius of a change  → skill-impact-predictor/SKILL.md
CI/CD pipeline or GitHub Actions  → skill-devops-github-actions/SKILL.md
DSPy evaluation quality / tuning  → skill-ai-dspy-validator/SKILL.md
```

---

## Skill Index

| Skill | Domain | When to load |
|:---|:---|:---|
| [skill-guard-governance](skill-guard-governance/SKILL.md) | Governance | Writing / registering a Guard |
| [skill-threat-modeling-expert](skill-threat-modeling-expert/SKILL.md) | Security | Designing threat coverage |
| [skill-test-architect](skill-test-architect/SKILL.md) | Testing | Adversarial test design |
| [skill-review-code](skill-review-code/SKILL.md) | Quality | PR code review |
| [skill-surgical-refactorer](skill-surgical-refactorer/SKILL.md) | Refactoring | Safe guard refactors |
| [skill-impact-predictor](skill-impact-predictor/SKILL.md) | Governance | Pre-implementation blast-radius analysis |
| [skill-devops-github-actions](skill-devops-github-actions/SKILL.md) | CI/CD | GitHub Actions / CI gates |
| [skill-ai-dspy-validator](skill-ai-dspy-validator/SKILL.md) | Intelligence | DSPy eval quality |

---

## Skill Standards

See [SKILL_STANDARDS.md](SKILL_STANDARDS.md) for the contract every skill must satisfy.
