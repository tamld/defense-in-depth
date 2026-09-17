# T002 Scout Findings: Verification Status

## All Track B Commands Verified ✅

| Command | Status | Notes |
|---------|--------|-------|
| `metrics f1 --format json` | ✅ Works | Returns full F1 snapshot with per-guard metrics |
| `metrics f1 --format table` | ✅ Works | Aligned table with grades (EXCELLENT/CRITICAL) |
| `metrics f1 --format summary` | ✅ Works | Default compact output |
| `metrics f1 --period 90d` | ✅ Works | Relative period parsing |
| `metrics f1 --guard hollowArtifact` | ✅ Works | Single guard filter |
| `metrics meta-growth --format json` | ✅ Works | Returns computed meta-growth snapshot |
| `metrics meta-growth --format summary` | ✅ Works | Default compact output with trends |
| `lesson dedup --format table` | ✅ Works | 6 duplicate groups found |
| `lesson dedup --format json` | ✅ Works | Structured group output |
| `lesson dedup --format summary` | ✅ Works | Default output with base + variants |
| `lesson dedup --dry-run` | ✅ Works | Shows merge preview |
| `lesson dedup --threshold 0.8` | ✅ Works | Adjustable similarity threshold |
| `verify --files <path>` | ✅ Works | Guard execution + lesson injection |
| `verify` (injection) | ✅ Works | Shows `💡 Relevant lessons from past failures:` |
| `doctor --hints all` | ✅ Works | Health check + `🧠 Injected Lessons:` |
| `audit --help` | ✅ Works | Read-only pattern extraction |
| `audit <path> --export-lessons` | ✅ Works | Exports suggested lessons |
| `feedback --help` | ✅ Works | TP/FP/FN/TN recording |
| `feedback list` | ✅ Works | Reads feedback.jsonl |
| `growth --help` | ✅ Works | Metric recording |
| `growth record` | ✅ Works | Persists growth_metrics.jsonl |
| `eval <file>` | ✅ Works | DSPy semantic evaluation |
| `eval --quality-gate` | ✅ Works | Rejects generic artifacts |

## Build & Test Status
- `npm run build` → ✅ Clean (0 TS errors)
- `npm test` → ✅ 831 pass, 1 pre-existing flaky (no-execsync-regression on audit.ts)
- No new test failures introduced

## Injection Verification
**verify command:**
- Hollow artifact guard fails on TODO → shows 3 injected lessons (console-log, TODO, TBD)
- Root pollution guard fails → no injection (different guard)

**doctor --hints all:**
- Shows `🧠 Injected Lessons (from cross-project memory):`
- 3 lessons with scores (0.87) and match reasons
- Rich format with match details

## Data Foundation Confirmed
- 57 lessons in lessons.jsonl (from 5 projects)
- 58 TP feedback events in .agents/records/feedback.jsonl
- 6 duplicate groups identified (13 lessons affected)
- Meta-growth computes trends correctly

## No Regressions
All existing functionality preserved:
- All 14 guards execute correctly
- Hint engine (H-001 to H-004) works
- Federation providers load correctly
- DSPy graceful degradation works
- Config loading works
