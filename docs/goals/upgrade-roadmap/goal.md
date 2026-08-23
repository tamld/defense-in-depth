# Goal Charter: Autonomous Upgrade Roadmap — defense-in-depth

> **Slug**: upgrade-roadmap · **Mode**: execution (continuous) · **Harness**: claude-code (Sisyphus PM)
> **Sponsor**: tamld · **Authority**: `/goal` command m0134 approving Sisyphus's 4-wave proposal (m0133)

## Original Outcome (owner words, translated)

"Em tự thiết kế cơ chế thành công, hoàn thành công việc, sau đó tự hành vận hành và nâng cấp project theo các chặng em đã thiết kế. Không làm vượt boundary hệ thống, ra khỏi project này."

= Execute the 4-wave upgrade roadmap autonomously, end-to-end, staying strictly inside the defense-in-depth repository boundary.

## Success Criteria

1. **W1**: Real PR through active ruleset 14874847 adds `defense-in-depth verify --files` dogfooding to CI (closes P2 debt; exercises protection mechanism live).
2. **W2**: Coverage gate reaches `{line≥95, branch≥95, funcs≥95}` honestly (tests-first, threshold bump last commit), per `plans/coverage-95/SRS.md`.
3. **W3**: Release path prepared: F1 deprecation warnings fixed; version decision documented (final selection = sponsor policy decision, expected BLOCKED receipt); publish dry-run validated (`npm pack`).
4. **W4**: Hardening landed: Dependabot config, secret scanning enabled via settings where API-accessible, red-CI alerting note; types.ts split deferred if out of time-box (documented, not silently dropped).
5. Every wave flows through a PR against the protected main (dogfood by construction). Final Judge audit maps all receipts to these criteria.

## Hard Boundaries

- Repository scope: `tamld/defense-in-depth` ONLY. No other repos, no external systems.
- HITL: human merges are permitted via owner bypass, but every substantive change still gets a PR record. Sponsor approval phrases already given: (b9) cleanup approvals; m0134 grants autonomy for THIS roadmap.
- Forbidden without new explicit instruction: AGENTS.md/GEMINI.md/CLAUDE.md/STRATEGY.md content changes, .agents/** governance files, package.json except pnpm-related (already done), destructive git ops beyond agreed branch hygiene.
- No new runtime dependencies (Tier 0 purity). Tests use node:test stdlib only.
