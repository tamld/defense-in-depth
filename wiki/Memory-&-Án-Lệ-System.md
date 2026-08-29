# Memory & Án Lệ (Case Law) System

> **The cognitive learning flywheel: converting developer feedback and past failures into permanent repository wisdom.**

---

## 🧠 What is Án Lệ (Case Law)?

When AI coding agents make mistakes, prompting them repeatedly produces ephemeral fixes that fade as context shifts. **Án Lệ** establishes a permanent, version-controlled case-law system where past architectural decisions, failure patterns, and human review feedback become searchable rules and hints.

---

## 🔄 The Memory Flywheel

```mermaid
flowchart LR
    A["Guard Block / Alert"] --> B["Developer Resolves Issue"]
    B --> C["did feedback / did lesson"]
    C --> D[".agents/records/lessons.jsonl"]
    D --> E["Progressive Hints & F1 Evaluation"]
    E --> F["Future Agent Runs Avoid Mistake"]
```

---

## 📂 Storage Architecture (Append-Only JSONL)

1. **`feedback.jsonl`**: Captures human labels (`TP` = True Positive, `FP` = False Positive, `TN`, `FN`) for guard findings to compute Precision, Recall, and F1 metrics.
2. **`lessons.jsonl`**: Captures structured architectural lessons containing `wrongApproach`, `correctApproach`, and searchable tags.
3. **`hints-shown.json`**: Tracks progressive hint cooldowns to eliminate hint fatigue.

---

## 💡 Progressive Discovery Hints Engine

The hint engine evaluates repository maturity against an **earned capability matrix**:

- `H-001-no-dspy`: Suggests enabling DSPy semantic checks after ≥ 5 commits.
- `H-002-no-lessons`: Suggests recording an Án Lệ when recurring blocks occur.
- `H-003-no-feedback`: Encourages feedback labeling to calibrate F1 scores.
- `H-004-no-federation`: Suggests cross-repo ticket federation in multi-contributor repos.
