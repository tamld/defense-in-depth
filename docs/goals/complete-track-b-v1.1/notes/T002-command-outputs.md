# T002 Scout Findings: Command Output Samples for Docs

## `metrics f1 --format json`
```json
{
  "window": "2026-08-13/2026-09-13T16:59:59.999Z",
  "guards": {
    "hollowArtifact": { "guardId": "hollowArtifact", "period": "...", "totalRuns": 42, "truePositives": 42, "falsePositives": 0, "falseNegatives": 0, "precision": 1, "recall": 1, "f1": 1, "computedAt": "..." },
    "ssotPollution": { "totalRuns": 7, "truePositives": 7, "f1": 1 },
    "rootPollution": { "totalRuns": 7, "truePositives": 7, "f1": 1 },
    "commitFormat": { "totalRuns": 0, "f1": 0 },
    "branchNaming": { "totalRuns": 0, "f1": 0 },
    "phaseGate": { "totalRuns": 0, "f1": 0 },
    "ticketIdentity": { "totalRuns": 0, "f1": 0 },
    "hitlReview": { "totalRuns": 0, "f1": 0 },
    "federation": { "totalRuns": 0, "f1": 0 },
    "secretDetection": { "totalRuns": 0, "f1": 0 },
    "fileSizeLimit": { "totalRuns": 0, "f1": 0 },
    "dependencyAudit": { "totalRuns": 0, "f1": 0 },
    "noTypeSafetyBypass": { "totalRuns": 2, "truePositives": 2, "f1": 1 },
    "noSwallowedError": { "totalRuns": 0, "f1": 0 },
    "noStubReturn": { "totalRuns": 0, "f1": 0 },
    "noTriviallyTrueTest": { "totalRuns": 0, "f1": 0 },
    "selfProtection": { "totalRuns": 0, "f1": 0 }
  },
  "overall": { "macroF1": 1, "macroPrecision": 1, "macroRecall": 1, "microF1": 1, "totalTP": 58, "totalFP": 0, "totalFN": 0, "totalRuns": 58 }
}
```

## `metrics f1 --format table`
```
Period: 2026-08-13/2026-09-13T16:59:59.999Z

Guard ID            | F1    | Precision | Recall | Grade     | TP | FP | FN | Runs
--------------------+-------+-----------+--------+-----------+----+----+----+-----
hollowArtifact      | 1.000 | 1.000     | 1.000  | EXCELLENT | 42 | 0  | 0  | 42  
ssotPollution       | 1.000 | 1.000     | 1.000  | EXCELLENT | 7  | 0  | 0  | 7   
rootPollution       | 1.000 | 1.000     | 1.000  | EXCELLENT | 7  | 0  | 0  | 7   
commitFormat        | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
branchNaming        | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
phaseGate           | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
ticketIdentity      | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
hitlReview          | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
federation          | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
secretDetection     | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
fileSizeLimit       | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
dependencyAudit     | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
noTypeSafetyBypass  | 1.000 | 1.000     | 1.000  | EXCELLENT | 2  | 0  | 0  | 2   
noSwallowedError    | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
noStubReturn        | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
noTriviallyTrueTest | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
selfProtection      | 0.000 | 0.000     | 0.000  | CRITICAL  | 0  | 0  | 0  | 0   
OVERALL             | 1.000 | 1.000     | 1.000  | EXCELLENT | 58 | 0  | 0  | 58  
```

## `metrics meta-growth --format json`
```json
{
  "period": "2026-08-13/2026-09-13T16:59:59.999Z",
  "lessonsCreated": 1,
  "lessonsEffective": 0,
  "guardFalsePositiveTrend": "degrading",
  "timeToGuardHours": 72,
  "communityContributions": 0,
  "lessonSpecificityScore": 0.15,
  "lessonsPerWeek": 0.2207621551397146,
  "runtimeEvidenceRatio": 0,
  "trends": {
    "lessonsCreated": "degrading",
    "lessonsEffective": "degrading",
    "guardFPRate": "degrading",
    "timeToGuard": "stable"
  },
  "computedAt": "2026-09-13T15:51:15.231Z"
}
```

## `lesson dedup --format table`
```
🔍 Analyzing lessons for duplicates (threshold: 0.75)...

Found 6 duplicate group(s) affecting 13 lessons:

Group | Count | Base ID | Title
------|-------|---------|------
1 | 4 | audit-qn | Recurring CONSOLE-LOG pattern (190 occurrences)
2 | 4 | audit-1h | Recurring TODO pattern (74 occurrences)
3 | 3 | audit-9z | Recurring TBD pattern (33 occurrences)
4 | 3 | audit-dt | Recurring HACK pattern (10 occurrences)
5 | 2 | audit-0x | Recurring TYPE-ANY pattern (53 occurrences)
6 | 3 | audit-8z | Recurring FIXME pattern (6 occurrences)
```

## `verify --files <test.md>` (with injection)
```bash
🛡️  defense-in-depth verify

  ❌ Hollow Artifact Detector
     🚫 Hollow content detected: pattern "TODO" found in test-verify.md
        💡 Fix: Edit test-verify.md and replace placeholder content with substantive information.
     ⚠️  File test-verify.md has only 20 chars of meaningful content (minimum: 50)

💡 Relevant lessons from past failures:
  📚 audit-qn Recurring CONSOLE-LOG pattern (190 occurrences)
  📚 audit-1h Recurring TODO pattern (74 occurrences)
  📚 audit-9z Recurring TBD pattern (33 occurrences)
  ✅ SSoT Pollution Detector
  ❌ Root Pollution Guard
     🚫 [Ecosystem Pollution] File "test-verify.md" is NOT allowed at the project root.
        💡 Fix: git reset HEAD "test-verify.md" && mv "test-verify.md" <target-directory>/

Guiding Map for AI Agents:
  - 🧠 Scratch/Drafts/Memory -> .gemini/brain/, .claude/, .cursor/, or /tmp/
  - 📜 Documentation -> docs/
  - ⚙️ Governance/Rules -> .agents/rules/
  - 💻 Source Code -> src/
  ✅ Commit Format Enforcer
  ...
📊 12/14 guards passed (2ms)
```

## `doctor --hints all` (with injection)
```bash
🩺 defense-in-depth doctor

  ✅ Git repository found
  ⚠️  No config file found (using defaults)
     Run 'defense-in-depth init' to create one.
  ❌ pre-commit hook not installed
  ❌ pre-push hook not installed

⚠️  2 issue(s) found. Run 'defense-in-depth init' to fix.

🧠 Injected Lessons (from cross-project memory):
  📚 audit-qn Recurring CONSOLE-LOG pattern (190 occurrences)
   → Resolve console-log markers before commit. Use proper implementation instead of placeholders. [wrongApproachPattern: console-log, tag: console-log]
     Match: wrongApproachPattern: console-log, tag: console-log, category: process (score: 0.87)
  📚 audit-1h Recurring TODO pattern (74 occurrences)
   → Resolve todo markers before commit. Use proper implementation instead of placeholders. [wrongApproachPattern: todo, tag: todo]
     Match: wrongApproachPattern: todo, tag: todo, category: process (score: 0.87)
  📚 audit-9z Recurring TBD pattern (33 occurrences)
   → Resolve tbd markers before commit. Use proper implementation instead of placeholders. [wrongApproachPattern: tbd, tag: tbd]
     Match: wrongApproachPattern: tbd, tag: tbd, category: process (score: 0.87)
```

## `audit --help`
```
❌ Audit requires a target path: `defense-in-depth audit <path>`

🔍 defense-in-depth audit — Read-only pattern extraction

Usage:
  defense-in-depth audit <target-path> [options]

Options:
  --output json|text        Output format (default: text)
  --export-lessons <path>   Export suggested lessons to JSONL file

Examples:
  defense-in-depth audit ../my-project
  defense-in-depth audit ../my-project --output json
  defense-in-depth audit ../my-project --export-lessons .agents/records/audit-lessons.jsonl
```

## `feedback --help`
```
📊 did feedback — Guard F1 input pipeline (issue #22 MVP)

Usage:
  did feedback <tp|fp|fn|tn> --guard <id> [--ticket TKID]
                             --finding <text-or-hash> [--note "..."]
  did feedback list   [--guard <id>] [--since <iso>] [--limit N]
  did feedback f1     --guard <id> [--period <iso-start>/<iso-end>]
  did feedback scan-history [--since <git-ref>] [--max N] [--dry-run]

Storage: .agents/records/feedback.jsonl (append-only, idempotent on id)
```

## `growth --help`
```
🛡️  defense-in-depth growth — Growth Metrics Tracking

Commands:
  record    Record a new growth metric.
            --name <string>      Metadata name (e.g. guard_false_positive_rate)
            --value <number>     Numeric value
            --unit <string>      Unit of measurement (e.g. 'percentage', 'count')
            [--source <string>]  Optional trigger source
            [--trend <string>]   Optional trend (improving|stable|degrading)

Examples:
  npx defense-in-depth growth record --name "lessons_per_ticket" --value 2 --unit "count" --source "TK-123"
```

## `eval --help`
```
❌ Usage: defense-in-depth eval <path_to_file>
```
