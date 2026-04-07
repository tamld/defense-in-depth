---
id: RULE-FLOWCHART-MANDATE
status: active
version: 1.0.0
enforcement: advisory
cognitive_branch: evidence
ported_from: AAOS rule-flowchart-mandate v1.0.0
---

# RULE: Mandatory Decision Flowcharts (The Visual Compliance Doctrine)

> **Text is probabilistic. Flowcharts are deterministic. An agent reading prose will hallucinate step order; an agent following a flowchart cannot.**

---

## 1. The Mandate

Any agent-facing document containing **≥ 2 branching decisions** MUST include a
mermaid decision flowchart.

| Document Type | Location | Threshold |
|:---|:---|:---:|
| Rules | `.agents/rules/` | ≥ 2 branches |
| Workflows | `.agents/workflows/` | ≥ 2 branches |
| Skills | `.agents/skills/*/SKILL.md` | ≥ 3 branches |
| Contracts | `.agents/contracts/` | ≥ 2 branches |

---

## 2. Flowchart Requirements

| Requirement | Why |
|:---|:---|
| Decision points use `{Diamond}` nodes | Forces explicit branching |
| ALL documented branches appear as edges | No hidden paths |
| If doc defines an enum, flowchart routes to ALL values | Complete coverage |
| Flowchart appears near top of document | Agent sees visual contract first |
| Flowchart replaces prose, not duplicates it | Budget efficiency |

---

## 3. Why This Matters (Anti-Hallucination)

**Without flowchart:**
> "If critical issues exist, block. If medium severity, warn. Otherwise pass."

An agent reads this and may skip the "medium" case entirely.

**With flowchart:**
```
Decision{Severity?} -->|critical| BLOCK
                   -->|medium| WARN  
                   -->|clean| PASS
```

Diamond node forces agent through ALL explicit paths. Zero ambiguity.

---

## 4. Verification

All current rules in this project already follow this mandate. Future contributions
must maintain this standard:

```bash
# Find docs with branching but no flowchart
grep -rl "if\|when\|else\|branch" .agents/rules/ .agents/workflows/ | \
  xargs -I{} sh -c 'grep -L "mermaid" {} && echo "⚠ MISSING: {}"'
```

---

## 5. Anti-Patterns

| ❌ Pattern | Fix |
|:---|:---|
| Rule with 5 conditions, no diagram | Add mermaid flowchart |
| Flowchart that only shows happy path | Add error/rejection branches |
| Prose AND flowchart showing same logic | Remove redundant prose |

---

## Executable Logic

```javascript
WARN_IF_MATCHES: /branch.*without.*flowchart|decision.*without.*mermaid|skip.*diagram/i
```
