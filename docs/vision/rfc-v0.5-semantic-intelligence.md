# RFC: v0.5 Semantic Intelligence & Quality Governance

**Status:** Under Consideration (Draft)
**Target Version:** v0.5 
**Author:** AAOS Core Team

## 1. Context & Problem Statement

Current `defense-in-depth` guards are extremely fast and effective at **structural governance**. They can deterministically enforce:
- Does an artifact exist? (`phase-gate`)
- Is an artifact hollow? (`hollow-artifact`)
- Is a branch or commit formatted correctly? (`branch-naming`, `commit-format`)
- Is an agent polluting SSoT files? (`ssot-pollution`)

However, they are completely blind to **semantic quality**:
- Is the content in `implementation_plan.md` logically sound?
- Does the `reflection.md` actually contain insights, or is it verbose but empty?
- Does the code fix correctly align with the `TICKET.md` problem statement?

Because LLMs optimize for plausibility rather than truth, an agent can successfully bypass all v0.1 - v0.4 structural guards by simply writing a 1,000-word essay of plausible-sounding nonsense that satisfies the `minContentLength` checks.

## 2. Proposed Solution: DSPy-Driven Semantic Convergence

In v0.5, we introduce the **Semantic Intelligence** layer. This layer bridges the gap between deterministic string parsing and probabilistic reasoning by treating LLM evaluation as a programmable, compile-safe module via **DSPy**.

### 2.1 The `EvaluationScore` Type

As laid out in `src/core/types.ts`:

```typescript
export interface EvaluationScore {
  score: number;        // 0.0 to 1.0
  reasoning: string;    // Explain why this score was given
  metrics: {
    [key: string]: number; // e.g., { relevance: 0.8, actionability: 0.2 }
  }
}
```

### 2.2 DSPy Adapter & Semantic Guards

We will build a pipeline that permits computationally heavy semantic analysis to happen out-of-band or on demand. 

- **Structural Guards (Fast):** Run in `<100ms`, block structural errors instantaneously.
- **Semantic Guards (Heavy):** Run asynchronously or synchronously during critical transitions (e.g. `ag flow finalize`). They use DSPy to compile prompts and evaluate artifact quality based on a strict rubric.

Example guard: `semantic-quality.ts`. 

## 3. Scope & Implementation Path

1. **Phase 1: Adapter Interface**
   Add a standard inference adapter to `defense-in-depth` so guards can call external DSPy servers or directly talk to local/remote models to generate `EvaluationScore`s.

2. **Phase 2: Core Semantic Guards**
   - *Plan Consistency Evaluator*: Checks if `implementation_plan.md` addresses `TICKET.md`.
   - *Lesson Dedup & Quality Guard*: Checks if a new lesson in `reflection.md` is novel or just a duplicate of an existing lesson in `records/lessons.jsonl`.

3. **Phase 3: Threshold based blocking**
   Update `defense.config.yml` to allow configuring semantic blocking thresholds:
   ```yaml
   guards:
     semanticQuality:
       enabled: true
       minimumScore: 0.7 
       artifacts: ["reflection.md", "implementation_plan.md"]
   ```

## 4. Drawbacks & Alternatives

### Drawbacks
- **Latency:** Semantic evaluation requires model inference. A Git hook that takes 10+ seconds destroys developer experience (DX).
- **Cost:** Requires hitting an API or running a local model.

### Mitigations
- Semantic guards must clearly indicate their status and fail gracefully.
- Run them asynchronously where possible, or only execute during `ag flow finalize` (higher DX tolerance) rather than every `git commit`.

## 5. Unresolved Questions

1. Should the DSPy inference engine be bundled natively, or expected to be hosted locally/cloud and provided via an API endpoint?
2. How to ensure these Semantic Guards output stable JSON metrics reliably across various OS environments?
