# Progressive Discovery Hints

defense-in-depth ships with a built-in hint engine that surfaces optional
Tier-1 / Tier-2 features the moment your repo has *earned* the next
capability — not before. The goal is to bridge a Persona A solo developer
("I just want guards on commits") to Persona B ("I want DSPy semantic checks
+ Án Lệ memory + F1 feedback") without spam.

This page documents what hints exist, how they fire, and how to silence them.

## Quick reference

| Surface | Default behaviour | Disable channel |
|:--|:--|:--|
| `did doctor` | At most **one** earned hint after the 4-check summary | `hints.channels` does not include `doctor` |
| `did verify` (success) | At most **one** earned hint after a clean run | `hints.channels` does not include `verify-success` |
| `did doctor --hints` | All eligible hints, no cap | — |
| `did doctor --hints dismiss <id>` | Permanently silence one hint | n/a — this *is* the silencer |
| `did doctor --hints reset` | Wipe `.agents/state/hints-shown.json` | n/a |
| `NO_HINTS=1` env | Skip hint emission for the current invocation | — |
| `CI=true` env | Skip hint emission entirely (CI log-cleanliness contract) | — |
| `hints.enabled: false` in config | Disable globally | — |

The state file is `.agents/state/hints-shown.json`. It tracks `lastShownAt`,
`dismissedAt`, and `shownCount` per hint. It is rewritten atomically (temp
file + rename) so concurrent CLI invocations cannot corrupt it.

## The hint catalog

| ID | Trigger | Body |
|:--|:--|:--|
| `H-001-no-dspy` | Repo has ≥ 5 commits AND the hollow-artifact guard does not have `useDspy: true` | Suggests enabling DSPy semantic checks (`docs/dev-guide/dspy-providers.md`). |
| `H-002-no-lessons` | `lessons.jsonl` is missing/empty AND a TP/FP feedback event was recorded in the last 30 days | Suggests recording an Án Lệ so the same blocker is recoverable next time (`did lesson record --help`). |
| `H-003-no-feedback` | `feedback.jsonl` has < 5 entries AND repo has ≥ 10 commits | Suggests labelling guard findings as TP/FP/FN/TN (`did feedback --help`) so F1 has signal. |
| `H-004-no-federation` | `CHANGELOG.md` or `docs/` exist AND repo has > 1 contributor AND no `federation:` config block | Suggests linking commits to external tickets (`docs/dev-guide/federation.md`). |

Each hint is **earned** — pure cold-start repos see zero hints. The catalog
is intentionally small in v0.7; future versions will add hints behind the
same earned-trigger discipline.

## Output shape

When stderr is a TTY, hints render in dim grey so they don't drown out
errors:

```
💡 Tip: defense-in-depth supports DSPy semantic checks for hollow-artifact
   guard. See docs/dev-guide/dspy-providers.md to enable them.
   (Hide: did doctor --hints dismiss H-001-no-dspy | NO_HINTS=1)
```

When stderr is not a TTY (pipelines, redirected output, CI logs not gated
by `CI=true`), the dim ANSI codes are stripped automatically.

## Configuration

`defense.config.yml`:

```yaml
hints:
  enabled: true                         # master switch (default: true)
  cooldownDays: 7                       # min days between re-showings of a given hint
  channels:                             # which CLI surfaces emit hints
    - doctor
    - verify-success
```

The defaults match what `did init` writes for new projects. Setting
`hints.enabled: false` disables the engine entirely; trimming `channels`
disables specific surfaces while keeping the rest active.

## Why three layers of restraint

The biggest risk for any "discovery" UX is hint fatigue — the first time a
user dismisses a tip, the second time they ignore it, the third time they
disable the entire tool. defense-in-depth prevents that with three independent
layers:

1. **Earned trigger.** Every hint requires a concrete signal in the repo
   state. No commit history → no `H-001`. No recent guard block → no
   `H-002`. We never advertise features the user hasn't earned.
2. **Frequency cap.** At most one hint per invocation by default. A 7-day
   cooldown per hint id prevents the same suggestion from re-firing.
3. **User control.** Three independent escape hatches: per-hint `dismiss`,
   `NO_HINTS=1` env, and the `hints.enabled: false` config flag.

CI log cleanliness is a fourth layer baked in: `CI=true` short-circuits
emission entirely, so build logs stay clean regardless of repo state.

## See also

- `docs/dev-guide/architecture.md` — how the hint engine plugs into the
  CLI surface.
- Issue [#21](https://github.com/tamld/defense-in-depth/issues/21) — the
  original Progressive Discovery UX proposal.
