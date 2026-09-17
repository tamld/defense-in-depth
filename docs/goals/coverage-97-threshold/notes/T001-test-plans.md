# T001 Scout: Test Plans for 6 Untested Modules

## 1. src/cli/audit.ts — Audit Command (Read-only pattern extraction)

**Public API to test:**
- `auditCommand(projectRoot, args)` — main entry point
- `runAudit(targetPath, options)` — full audit workflow
- `runVerifyReadOnly(targetPath, options)` — guard verification on target
- `findScannableFiles(targetPath, options)` — file discovery
- `extractCodePatterns(targetPath, options)` — TODO/FIXME/HACK/empty-catch/console-log/type-any detection
- `extractCommitPatterns(targetPath)` — git log analysis (fix/refactor/hack/workaround/revert)
- `checkConfigDrift(targetPath)` — package.json & tsconfig.json drift
- `scanFileSizes(targetPath)` — large file detection (>100KB)
- `generateSuggestedLessons(...)` — lesson generation from findings
- `parseAuditOptions(args)` — CLI arg parsing
- `printAuditUsage()`, `printAuditSummary(result)` — output formatting

**Key behaviors to cover:**
- Target path validation (exists, not exists)
- Output formats: json, text
- Export lessons to JSONL
- Read-only: no modifications to target project
- Graceful degradation on git errors, missing configs
- Pattern detection accuracy (categories, counts, file lists)
- Commit pattern categorization (fix/refactor/hack/workaround/revert)
- Config drift types (missing/different/extra)
- File size categories (large >100KB, huge >1000KB)

**Mocking needs:**
- `fs` operations (readFileSync, writeFileSync, existsSync, statSync)
- `glob` for file discovery
- `execFileSync` for git log
- `DefendEngine` and `loadConfig` for verify
- Temp directory fixtures for integration tests

---

## 2. src/cli/lesson/dedup.ts — Lesson Dedup CLI

**Public API to test:**
- `runDedup(projectRoot, args)` — main entry point
- `printSummary(groups)` — summary output format
- `printTable(groups)` — table output format
- `printDedupUsage()` — help text

**Key behaviors to cover:**
- Threshold parsing (--threshold, -t)
- Auto-merge flag (--auto-merge)
- Format options: json, table, summary
- Dry-run flag (--dry-run)
- Help flag (--help, -h)
- No duplicates found case
- Groups found case with all 3 formats
- Auto-merge preview (dry-run) vs actual merge (not yet implemented)

**Dependencies to mock:**
- `analyzeLessons` from core/dedup.ts
- `mergeLessons` from core/dedup.ts

---

## 3. src/cli/metrics.ts — Metrics CLI (f1 + meta-growth)

**Public API to test:**
- `handleMetricsCommand(projectRoot, args)` — main entry point
- `handleF1Command(projectRoot, args)` — F1 subcommand
- `handleMetaGrowthCommand(projectRoot, args)` — meta-growth subcommand
- `parsePeriod(period)` — period parsing (30d, 7d, 90d, 12m, ISO interval)
- `computeAllF1(projectRoot, period, guardId?)` — F1 computation
- `formatJson(metrics, period)` — JSON output
- `formatTable(metrics, period)` — table output
- `formatSummary(metrics, period)` — summary output (default)
- `gradeF1(f1)` — grading: EXCELLENT/GOOD/FAIR/POOR/CRITICAL
- `computeOverall(metrics)` — macro/micro aggregation
- `printMetricsUsage()`, `printMetaGrowthUsage()` — help text

**Key behaviors to cover:**
- Period parsing: relative (30d, 7d, 90d, 12m) and ISO intervals
- Invalid period error handling
- Format options: json, table, summary
- Guard filter (--guard, -g)
- Help flag
- Unknown subcommand error
- Zero-data guards handling
- Macro vs micro F1 computation
- F1 grading thresholds

**Dependencies to mock:**
- `computeF1FromFeedback` from core/feedback.js
- `readFeedback` from core/feedback.js
- `allBuiltinGuards` from guards/index.js
- `computeMetaGrowth` from core/metagrowth.js

---

## 4. src/core/dedup.ts — Lesson Deduplication Engine

**Public API to test:**
- `LessonDeduplicator` class
  - `constructor(config)` — config with defaults
  - `analyze(projectRoot)` — find duplicate groups
  - `computeSimilarity(lessonA, lessonB)` — similarity scoring
  - `mergeGroup(group)` — merge into canonical lesson
  - `mergeAll(projectRoot)` — merge all groups
- `analyzeLessons(projectRoot, config)` — convenience function
- `mergeLessons(projectRoot, config)` — convenience function
- `DEFAULT_DEDUP_CONFIG` — defaults: threshold=0.75, autoMerge=false, preserveSources=true

**Similarity signals (weights):**
1. wrongApproachPattern exact match: +0.4
2. wrongApproachPattern substring: +0.3
3. Tag Jaccard overlap: +0.25 * jaccard
4. Title word overlap: +0.15 * similarity
5. Insight word overlap: +0.15 * similarity
5. Category match: +0.05
6. wrongApproach text similarity: +0.1 * similarity

**Merge behavior:**
- Base = highest confidence lesson
- Consolidates: tags, searchTerms, relatedFiles, relatedLessons
- Title: common prefix or base title + "[N variants]"
- wrongApproach: unique approaches numbered
- correctApproach: unique approaches numbered
- Insight: bullet list of unique insights
- Evidence: highest (RUNTIME > INFER > HYPO)
- CreatedAt: earliest in group

**Key behaviors to cover:**
- Empty/single lesson cases
- Threshold boundary (0.75 default)
- Multiple groups found
- Exact pattern match
- Tag overlap (Jaccard)
- Title/insight/wrongApproach similarity
- Category match
- Merge preserves highest confidence ID
- Project inference from relatedFiles/tags
- Common prefix title consolidation

**Dependencies to mock:**
- `readAllLessons` from memory.js

---

## 5. src/core/injection.ts — Lesson Injection Engine

**Public API to test:**
- `LessonInjector` class
  - `constructor(config)` — config with defaults
  - `inject(context)` — main entry point
- `injectLessons(context, config)` — convenience function
- `formatForVerify(injected)` — compact format for verify CLI
- `formatForDoctor(injected)` — rich format for doctor --hints
- `DEFAULT_INJECTION_CONFIG` — defaults: maxLessons=3, minScore=0.15, useSemantic=false

**Injection context:**
- guardId (e.g., "hollowArtifact")
- filePath
- finding text
- optional ticketId
- projectRoot

**Scoring signals (weights):**
1. Guard pattern match (wrongApproachPattern): +0.4
2. Tag overlap: +0.2 per matching tag
3. File path relation (same dir, parent/child, same basename): +0.25
4. Category relevance (guard-specific): +0.1
5. Evidence level: RUNTIME=0.15, INFER=0.1, HYPO=0.05
6. Confidence: +0.1 * confidence
7. Recency: <30 days +0.05, <90 days +0.02

**GUARD_PATTERN_MAP** — maps guardId to pattern keywords

**Key behaviors to cover:**
- Empty lessons cache → empty result
- Pre-filtering by guard patterns
- Scoring with all 7 signals
- Score capping at 1.0
- Min score threshold (default 0.15)
- Max lessons limit (default 3)
- File path relation logic (exact, same dir, parent/child, same basename)
- Category signals per guard
- Evidence weighting
- Recency bonus
- Format for verify (compact) vs doctor (rich with scores)
- Source project inference

**Dependencies to mock:**
- `readAllLessons` from memory.js
- `searchLessons` from memory.js

---

## 6. src/core/metagrowth.ts — Meta Growth Snapshot

**Public API to test:**
- `computeMetaGrowth(options)` — main entry point
- `readMetaGrowth(projectRoot)` — read all snapshots
- `getLatestMetaGrowth(projectRoot)` — get latest
- `MetaGrowthOptions` — { period, projectRoot }
- `MetaGrowthSnapshot` — output type

**Computed metrics:**
- lessonsCreated: count in period
- lessonsEffective: estimated 30% of created
- guardFalsePositiveTrend: "improving"/"stable"/"degrading"
- timeToGuardHours: placeholder 72h
- communityContributions: placeholder 0
- lessonSpecificityScore: 0-1 based on wrongApproachPattern, searchTerms, relatedFiles, tags, relatedLessons
- lessonsPerWeek: created / weeks in period
- runtimeEvidenceRatio: RUNTIME lessons / total
- trends: { lessonsCreated, lessonsEffective, guardFPRate, timeToGuard } — each "improving"/"stable"/"degrading"
- computedAt: ISO timestamp

**Persistence:**
- Appends to `.agents/records/meta-growth.jsonl`
- Read all / get latest

**Key behaviors to cover:**
- Period filtering (ISO interval parsing)
- Lesson filtering by createdAt
- Feedback filtering by period (TP/FP counts)
- FP trend: first half vs second half comparison
- Specificity scoring (5 signals, max 1.0)
- Runtime evidence ratio
- Lessons per week calculation
- Trend classification thresholds
- Persistence to JSONL
- Reading all snapshots
- Getting latest (null if none)

**Dependencies to mock:**
- `readAllLessons` from memory.js
- `readFeedback` from feedback.js
- `readCursor` from feedback.js
- `fs.promises` for file I/O

---

## Test Structure Recommendation

```
tests/
├── cli/
│   ├── audit.test.ts              # ~15 tests
│   ├── lesson/
│   │   └── dedup.test.ts          # ~10 tests
│   └── metrics.test.ts            # ~15 tests
├── core/
│   ├── dedup.test.ts              # ~15 tests
│   ├── injection.test.ts          # ~15 tests
│   └── metagrowth.test.ts         # ~10 tests
```

Total: ~80 new tests targeting the 6 untested modules.
