# CLI Reference

`defense-in-depth` operates primarily through git hooks, but also provides manual CLI commands for verification, diagnostics, and governance.

| Command | Description |
|:---|:---|
| `npx defense-in-depth init` | Install hooks + create config |
| `npx defense-in-depth init --scaffold` | Also create `.agents/` ecosystem (for agentic projects) |
| `npx defense-in-depth verify` | Run all enabled guards manually |
| `npx defense-in-depth verify --files a.md b.ts` | Target specific files |
| `npx defense-in-depth verify --dry-run-dspy` | Simulate DSPy unavailable |
| `npx defense-in-depth doctor` | Health check (config, hooks, custom guards) |
| `npx defense-in-depth doctor --hints` | Progressive Discovery hints (all \| dismiss \| reset) |
| `npx defense-in-depth audit` | Read-only pattern extraction from project |
| `npx defense-in-depth metrics f1` | Guard F1 scores from feedback |
| `npx defense-in-depth metrics meta-growth` | Growth system acceleration snapshot |
| `npx defense-in-depth lesson` | Manage lessons (record\|search\|outcome\|scan-outcomes\|recalls\|dedup) |
| `npx defense-in-depth feedback` | Record TP/FP/FN/TN labels for guards |
| `npx defense-in-depth growth` | Record growth metrics |
| `npx defense-in-depth eval` | DSPy semantic quality evaluation (opt-in) |

## Quick Examples

```bash
# Install hooks and config
npx defense-in-depth init

# Run guards on staged files (default)
npx defense-in-depth verify

# Run guards on specific files
npx defense-in-depth verify --files src/auth.ts docs/plan.md

# Health check with all hints
npx defense-in-depth doctor --hints all

# Extract patterns from another project (read-only)
npx defense-in-depth audit ../my-project --export-lessons .agents/records/audit-lessons.jsonl

# View F1 scores for all guards (last 30 days)
npx defense-in-depth metrics f1

# View F1 for specific guard, table format
npx defense-in-depth metrics f1 --guard hollowArtifact --format table

# Meta growth snapshot (last 90 days)
npx defense-in-depth metrics meta-growth --period 90d --format json

# Find duplicate lessons
npx defense-in-depth lesson dedup --threshold 0.8 --format table

# Record guard feedback (TP/FP/FN/TN)
npx defense-in-depth feedback tp --guard hollowArtifact --finding "TODO in src/auth.ts"

# Record growth metric
npx defense-in-depth growth record --name "lessons_per_week" --value 2 --unit count

# Evaluate artifact quality (opt-in DSPy)
npx defense-in-depth eval docs/plan.md --quality-gate
```
