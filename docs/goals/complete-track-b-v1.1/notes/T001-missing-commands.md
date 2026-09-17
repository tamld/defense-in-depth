# T001 Scout Findings: Missing Commands in cli-reference.md

## Currently Documented (4)
1. `init` — Install hooks + create config
2. `init --scaffold` — Also create `.agents/` ecosystem
3. `verify` — Run all enabled guards manually
4. `verify --files a.md b.ts` — Target specific files
5. `doctor` — Health check (config, hooks, custom guards)

## Implemented but Undocumented (7)

### `metrics f1`
```
did metrics f1 [--period 30d] [--format json|table|summary] [--guard <id>]
```
- Computes F1 scores per guard from feedback.jsonl
- Supports relative periods: 30d, 7d, 90d, 12m
- ISO intervals: 2026-09-01/2026-09-30
- Formats: json (full), table (aligned), summary (default with grades)

### `metrics meta-growth`
```
did metrics meta-growth [--period 30d] [--format json|summary]
```
- Measures growth system acceleration (Layer 3)
- Outputs: lessonsCreated, lessonsPerWeek, lessonsEffective, runtimeEvidenceRatio, lessonSpecificityScore, guardFalsePositiveTrend, timeToGuardHours, communityContributions, trends
- Trends: lessonsCreated, lessonsEffective, guardFPRate, timeToGuard (improving/stable/degrading)

### `lesson dedup`
```
did lesson dedup [--threshold 0.75] [--format json|table|summary] [--dry-run] [--auto-merge]
```
- Finds duplicate lessons by similarity scoring
- Signals: wrongApproachPattern (0.4), tags Jaccard (0.25), title overlap (0.15), insight overlap (0.15), category (0.05), wrongApproach text (0.1)
- 6 groups found in current 57 lessons (13 duplicates)

### `audit`
```
did audit <project-path> [--export-lessons <file>] [--format json]
```
- Read-only pattern extraction from target project
- Extracts: guard findings, code patterns (TODO/FIXME/HACK/TBD/console.log/type-any/empty-catch), commit history (fix/refactor/hack), config drift, large files
- Exports suggested lessons to JSONL
- Zero modifications to target project

### `feedback`
```
did feedback <tp|fp|fn|tn> --guard <id> --finding <text> [--ticket <id>] [--note <text>]
did feedback list [--guard <id>] [--since <date>] [--limit <n>]
did feedback scan-history [--dry-run] [--since <days>]
```
- Records TP/FP/FN/TN for guard findings (F1 input pipeline)
- scan-history infers labels from git: fix commits → TP, override comments → FP, reverts → FN

### `growth`
```
did growth record --metric <name> --value <n> [--unit <str>] [--source <str>] [--trend <up|down|stable>]
did growth list [--metric <name>] [--since <date>] [--limit <n>]
```
- Records growth metrics (lessonsCreated, f1, recall, etc.)
- Tracks velocity and quality over time

### `eval`
```
did eval <file> [--quality-gate] [--dspy]
```
- DSPy semantic quality evaluation for artifacts
- --quality-gate rejects generic artifacts (score < 0.5)
- Opt-in Tier 1 feature

## Recommended cli-reference.md Structure

| Command | Description |
|---------|-------------|
| `init` | Install hooks + create config |
| `init --scaffold` | Also create `.agents/` ecosystem |
| `verify` | Run all enabled guards manually |
| `verify --files <paths>` | Target specific files |
| `verify --dry-run-dspy` | Simulate DSPy unavailable |
| `doctor` | Health check (config, hooks, guards) |
| `doctor --hints` | Progressive Discovery hints (all|dismiss|reset) |
| `audit` | Read-only pattern extraction from project |
| `metrics f1` | Guard F1 scores from feedback |
| `metrics meta-growth` | Growth system acceleration snapshot |
| `lesson` | Manage lessons (record|search|outcome|scan-outcomes|recalls|dedup) |
| `feedback` | Record TP/FP/FN/TN labels for guards |
| `growth` | Record growth metrics |
| `eval` | DSPy semantic quality evaluation (opt-in) |
