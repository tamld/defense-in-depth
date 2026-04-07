---
id: RULE-DOCUMENT-BUDGET
status: active
version: 1.0.0
enforcement: advisory
cognitive_branch: mechanism
ported_from: AAOS rule-document-budget v1.0.0
---

# RULE: Document Size Budget (The Compression Doctrine)

> **Quality is density, not volume. A concise document agents follow is better than a long document they skip.**

Agent-facing documents must fit within context windows without causing Context Rot.

---

## 1. Hard Limits

| Document Type | Max Size | Rationale |
|:---|:---:|:---|
| Rules (`.agents/rules/`) | **8,000 bytes** | Always-loaded, must be concise |
| Workflows (`.agents/workflows/`) | **8,000 bytes** | Frequently loaded by agents |
| Skills (`SKILL.md`) | **10,000 bytes** | Complex instructions need room |
| Contracts (`.agents/contracts/`) | **6,000 bytes** | Interface specs are tight |

The budget is a **ceiling**, not a **target**. A 3KB rule that's clear beats an 8KB rule that's bloated.

---

## 2. Compression Strategies

When a document approaches its limit:

| Strategy | Example |
|:---|:---|
| **Flowcharts over prose** | Replace paragraphs with mermaid diagrams |
| **Tables over sentences** | Structured data is denser than prose |
| **Deduplicate** | If the flowchart shows the logic, remove redundant text |
| **Link, don't inline** | Reference other docs instead of repeating content |

### ❌ Anti-Pattern: Brain Split

**Never split one domain into multiple files** to bypass limits (e.g., `auth-part1.md`, `auth-part2.md`).
Splitting forces agents to load multiple files to understand one concept.
Instead: compress the single file.

---

## 3. The Compression Quality Principle

**Density ≠ Brevity.** Over-compression creates failure modes:

| ❌ Over-Compression | Result |
|:---|:---|
| Remove all examples | Agent hallucinates interpretation |
| Replace prose with terse tables lacking context | Agent follows table but doesn't understand why |
| Remove rationale ("Why") sections | Agent complies mechanically but misapplies in edge cases |

**Always preserve:** WHY (rationale), at least one Example, and DoNot anti-patterns.

---

## 4. Verification

```bash
wc -c .agents/rules/*.md  # Check each rule file size
wc -c .agents/workflows/*.md
```

---

## Executable Logic

```javascript
WARN_IF_MATCHES: /massive.*document|dump.*entire|500.*line.*file|split.*into.*parts/i
```
