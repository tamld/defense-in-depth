---
domain: governance
name: skill-impact-predictor
description: Trace import graph + test coverage of files about to be modified and produce an impact report before any code changes are made.
version: 1.0.0
type: specialist
role: The Blast Radius Calculator
---

# SKILL: skill-impact-predictor

## Identity

**Role**: The Blast Radius Calculator
**Philosophy**: Every change to a Guard or core module has a blast radius. Mapping it before editing prevents the silent regressions that this project's pre-commit pipeline cannot catch.

---

## Mission

Before any implementation begins on a DiD change, trace the dependency graph of the files about to be modified and produce a structured impact report that captures:

1. **Direct targets** — the files the agent intends to edit.
2. **Inbound consumers** — every file that imports or re-exports a direct target.
3. **Test coverage** — which tests under `tests/` exercise each direct target.
4. **Risk level** — LOW / MEDIUM / HIGH per the rules in §Workflow Step 5.
5. **Recommendation** — proceed, split the work, or write tests first.

The skill is a **planning artifact**. It runs before the diff exists. Running it after coding is theater and does not satisfy the hard gates below.

---

## Hard Gates

| ID | Gate | If FAIL |
|:--:|:--|:--|
| G1 | Run BEFORE any source edit. The agent's working tree must be clean (or contain only doc edits) when the report is produced. | STOP — post-hoc analysis is rejected. |
| G2 | The report cites real files in `src/`, `tests/`, or `.agents/`. No invented paths. | STOP — re-run discovery with `grep`/`rg`. |
| G3 | If a direct target is a public-API file (`src/core/types.ts`, `src/core/engine.ts`, `src/guards/index.ts`, `src/cli/index.ts`) AND risk is HIGH AND test coverage of the target is below 70% by file count, BLOCK and demand tests first. | BLOCK — return to issue queue. |
| G4 | If blast radius (direct + inbound consumers) exceeds 50 files, HALT and require splitting the work into smaller issues. | HALT — open child issues, do not proceed in one PR. |
| G5 | The skill must NOT widen its scope into refactoring, fixing unrelated issues, or modifying tests of unrelated modules. Pure analysis only. | STOP — file separate issues for collateral findings. |

---

## Workflow

### Step 1 — Define the explicit target list

Read the issue / PR description. Extract every file path the agent intends to edit. If the description says only "fix the federation guard", expand to a concrete list (e.g. `src/guards/federation.ts`, `src/federation/file-provider.ts`) and confirm with the human before continuing.

### Step 2 — Trace inbound consumers (1st degree)

For each direct target, find every file that imports it.

```bash
# In repo root
rg -l "from ['\"][^'\"]*<basename>['\"]" --type ts src tests
rg -l "require\\(['\"][^'\"]*<basename>['\"]\\)" src tests
```

Record the absolute count and the file list. Pay special attention to:
- `src/guards/index.ts` (barrel export — touching it ripples to every guard consumer)
- `src/core/types.ts` (Guard interface — touching it ripples to every guard)
- `src/core/engine.ts` (pipeline runner — touching it ripples to every CLI command)
- `src/cli/index.ts` (CLI router — touching it ripples to all `did *` subcommands)

### Step 3 — Trace 2nd-degree consumers

For every 1st-degree consumer, repeat Step 2. Stop at depth 2 unless the human asks for deeper. Cap the union of 1st + 2nd degree at 50 files (G4).

### Step 4 — Map test coverage

For each direct target, identify test files that exercise it.

```bash
# Strict: tests that import the target by relative path
rg -l "from ['\"]\\.\\./.*<basename>['\"]" tests
# Loose: tests that mention the basename anywhere
rg -l "<basename>" tests
```

Record both counts. A direct target with 0 strict-import tests is a **coverage gap** even if loose mentions exist.

### Step 5 — Score risk

Apply the rules in order; first match wins.

| Rule | Risk |
|:--|:--|
| Direct target mutates the `Finding.severity` contract or registry shape | HIGH |
| Direct target is a public-API file AND inbound consumers > 5 | HIGH |
| Direct target is a Guard (`src/guards/*.ts`) with 0 strict-import tests | HIGH |
| Direct target modifies an exported type/interface in `src/core/types.ts` | HIGH |
| Inbound consumers (1st + 2nd degree) > 20 | MEDIUM |
| All other cases | LOW |

All HIGH rules are listed before any MEDIUM rule so that "first match wins" cannot let a lower severity shadow a non-negotiable HIGH. New HIGH conditions added in future revisions MUST stay above the MEDIUM row.

The `Finding.severity` rule is non-negotiable per `SKILL_STANDARDS.md` §DiD-Specific Constraints — severity changes propagate to every CI gate consumer and to the federation child report shape.

### Step 6 — Emit the report

Write the report to the location agreed with the human (typically a comment on the issue or a scratch file the agent links from the PR). Use this exact structure:

```markdown
# Impact Report — <issue or PR id>

## Direct targets
- src/...
- src/...

## Inbound consumers (1st degree, count = N)
- src/...
- src/...

## Inbound consumers (2nd degree, count = M)
- src/...

## Test coverage (strict imports)
| Target | Strict-import tests | Loose mentions |
|:--|:-:|:-:|
| src/... | tests/... | ... |

## Risk level
HIGH | MEDIUM | LOW — <one-sentence justification>

## Recommendation
proceed | split (open child issues #X, #Y) | write tests first
```

---

## Output Contract

| Item | Requirement |
|:--|:--|
| Working tree state when the report is produced | Clean of source edits (G1). |
| File paths in the report | All cited files exist on disk in this repo (G2). |
| Risk level | One of HIGH / MEDIUM / LOW with a one-sentence justification grounded in §Workflow Step 5. |
| Recommendation | Aligned with the gates: HIGH + low coverage → "write tests first"; > 50 files → "split"; otherwise "proceed". |
| Evidence tag for each citation | `[CODE]` when the file exists on disk. Never `[HYPO]`. |

---

## Anti-Patterns

1. **Post-hoc impact reports.** Running the skill after the diff is already written produces a description of what changed, not a prediction of what could break. The whole value is pre-implementation.
2. **Stopping at direct imports.** Touching `src/core/types.ts` looks like a 3-file change until you trace the Guard interface ripple — every file in `src/guards/` becomes 1st-degree, every test in `tests/` becomes 2nd-degree. Always trace depth 2 for type/interface changes.
3. **Treating loose `rg` mentions as test coverage.** A test file that mentions `"federation"` in a string literal is not coverage. Coverage requires a strict import of the target module under test.
4. **Splitting the report across the PR description and the commit message.** The report is a single artifact. If it does not fit the PR description, link to a scratch file in the PR comments.
5. **Allowing the skill to bleed into refactoring.** The moment the agent edits a file outside the discovery commands above, the report is invalidated by G1. Refactor work belongs in `skill-surgical-refactorer` after the report is approved.
