---
id: RULE-ZERO-THEATER
status: active
version: 1.0.0
enforcement: deterministic
cognitive_branch: mechanism
---

# RULE: Zero Theater (The Substance Mandate)

> **An empty template is a lie to the system. Artifacts are evidence, not checkboxes.**

This rule is the **philosophical WHY** behind the `hollow-artifact` guard.
The guard is the mechanism. This rule is the intent.

---

## The Principle

Theater occurs when agents create artifacts that LOOK complete but CONTAIN nothing.
This satisfies workflow gates without producing value — the most dangerous form of
hallucination, because it passes automated checks.

## What Counts as Theater

| Pattern | Why It's Theater |
|:---|:---|
| `TODO` / `TBD` / `PLACEHOLDER` in artifacts | Promise without delivery |
| Headers-only documents (headings, no content beneath) | Skeleton pretending to be body |
| Empty test files (test scaffolding, no assertions) | Testing theater |
| Copy-pasted template with zero customization | Template ≠ artifact |
| Guard results without evidence examination | "It passes" without knowing what was checked |
| Plans that list actions but no rationale | Motion without thought |

## What Is NOT Theater

| Pattern | Why It's Legitimate |
|:---|:---|
| "Not applicable because this ticket has no frontend changes" | Explicit reasoning for absence |
| "Skipped: guard disabled in config" | Documented decision |
| Partial progress with clear next-steps section | Work in progress, not pretending to be done |
| Draft with `[DRAFT]` label and due date | Transparent status |

## Enforcement

The `hollow-artifact` guard is the **mechanical enforcement** of this rule.
But the rule applies beyond what the guard can detect:

| Layer | Enforcement |
|:---|:---|
| **Guard** (automated) | Detects TODO/TBD/PLACEHOLDER patterns in staged files |
| **Review** (human/agent) | Catches semantic hollowness the guard can't detect |
| **Self-discipline** (agent) | Agent refuses to create hollow artifacts proactively |

## Anti-Patterns

| ❌ Violation | ✅ Correct |
|:---|:---|
| Creating `plan.md` with only `# Plan` header | Writing actual plan content, even brief |
| Generating test file with `it('should work', () => {})` | Writing real assertions that test behavior |
| Filling PR template fields with "See code" | Summarizing what and why |
| Leaving TODO markers to "come back later" | Either do it now or create a ticket |

## Executable Logic

```javascript
WARN_IF_MATCHES: /TODO|TBD|PLACEHOLDER|FILL.*IN|INSERT.*HERE|see.*code|should.*work/i
```
