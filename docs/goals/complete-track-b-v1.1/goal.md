# Goal Charter: Complete Track B v1.1 — Docs, Verification, Zero Gaps

## Original Request
> "hoàn thiện tất cả nha em" — complete everything (docs updates, verification, zero gaps for Track B v1.1)

## Interpreted Outcome
All documentation reflects the **actual v1.1 implementation** (B1 F1 Aggregator, B2 Dedup, B3 Injection, B4 MetaGrowthSnapshot). Every CLI command is documented. Every feature verified working. Zero stale claims. Project ready for v1.1.0 release.

## Input Shape
`existing_plan` — We have a clear implementation (Track B phases B1-B4 all done). The gap is **documentation + final verification**. See `docs/goals/complete-track-b-v1.1/notes/implementation-inventory.md` for the facts.

## Audience / Beneficiary
- **Primary**: tamld (maintainer) — needs accurate docs for v1.1.0 release
- **Secondary**: future external users — need working quickstart + CLI reference

## Non-Goals & Hard Constraints
- ❌ No new feature implementation (Track B is complete)
- ❌ No breaking changes to public API
- ❌ No external telemetry without opt-in
- ❌ No network calls in verification
- ✅ All data local, privacy-first (`.agents/records/` gitignored for private projects)
- ✅ Must pass `npm test` and `npm run build` at completion

## Authority
`approved` — Track B implementation ratified; this tranche is docs + verification only.

## Proof Type
`test + artifact + metric` — Verification commands pass, docs updated, meta-growth snapshot shows healthy trends.

## Completion Proof (Goal Oracle)
**All of these must be true:**
1. `npm run build` → 0 TypeScript errors
2. `npm test` → 831+ pass, 0 new failures (1 pre-existing flaky allowed)
3. `docs/user-guide/cli-reference.md` lists all 10+ commands including `metrics f1`, `metrics meta-growth`, `lesson dedup`, `audit`, `feedback`, `growth`, `eval`
4. `docs/quickstart.md` hero section describes v1.1 (14 guards, lessons, hints, federation, injection)
5. `docs/user-guide/hints.md` documents lesson injection in `verify` + `doctor --hints all`
6. `docs/vision/meta-growth-roadmap.md` marks B1-B5 as DONE, B6 as v1.2+
7. `did metrics meta-growth --period 30d` runs without error and shows computed trends
6. `did lesson dedup --format table` runs and shows 6 groups
7. `did verify --files <test-file>` shows lesson injection output
8. Zero `[HYPO]` claims in docs for features that are now `[RUNTIME]`

## Likely Misfire
Updating only *some* docs (e.g., cli-reference but not quickstart) → partial completion claimed but user still sees stale quickstart.

## Blind Spots
1. **Cross-doc consistency**: A term like "Track B" might appear in meta-growth-roadmap but not in quickstart. Need consistent vocabulary.
2. **CLI help text**: The `--help` output for new commands should match docs.
3. **Migration guide**: `docs/MIGRATION-v0.1-to-v1.0.md` may need v1.1 notes.
4. **Pre-existing flaky test**: `tests/contract/no-execsync-regression.test.js` fails on `src/cli/audit.ts` — not our regression but must not block completion.

## Tranche Definition
This tranche = **Docs Sync + Final Verification**. Next tranche (if any) = v1.1.0 release engineering (tag, changelog, npm publish).

## Existing Plan Facts (Preserved)
Track B implementation completed in this session:
- B1: `src/cli/metrics.ts` → `metrics f1` (JSON/table/summary, --period, --guard)
- B2: `src/core/dedup.ts` + `src/cli/lesson/dedup.ts` → `lesson dedup` (6 groups found)
- B3: `src/core/injection.ts` → injection in `verify.ts` (inline) + `doctor.ts --hints all` (rich)
- B4: `src/core/metagrowth.ts` + `src/cli/metrics.ts` → `metrics meta-growth` (summary/JSON, trends)
- Data: 57 lessons, 58 TP feedback events, 5 projects dogfooded
- Tests: 831 pass, 1 pre-existing flaky (audit.ts execSync)