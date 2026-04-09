---
id: RULE-CODERABBIT-INTEGRATION
status: active
version: 1.0.0
enforcement: advisory
---

# RULE: CodeRabbit Integration & Review Protocol

> Defines how AI Agents (and humans) interact with CodeRabbit's automated feedback for THIS SPECIFIC REPOSITORY.

## 0. Anchors & Insight (Operation vs. Implementation Boundary)

> [!IMPORTANT]
> **Anti-Hallucination Anchor:**
> CodeRabbit is an **internal operational tool** chosen by the owners to review Pull Requests for *this specific project* (defense-in-depth).
> **CodeRabbit is NOT a feature, component, API, or roadmap item of the Defense-in-Depth framework itself.** 
> When documenting, discussing, or designing features for Defense-in-Depth, agents MUST NOT treat CodeRabbit as an integrated capability of the product. The product is strictly vendor-agnostic.

## 1. Metadata Storage (The `pr_feedback.json`)

CodeRabbit provides feedback in JSON format which AI Agents can parse to resolve automatically requested changes.


- **Location**: All CodeRabbit review dumps MUST be stored in `.agents/records/reviews/`.
- **Constraint**: Never leave `pr_feedback.json` in the project root.
- **Git Tracking**: Files in `.agents/records/reviews/` are ignored by git (via `.gitignore`) to prevent polluting the repository history with review cycle metadata.

## 2. Review Processing Workflow

When a CodeRabbit review is received with `state: "CHANGES_REQUESTED"` or `state: "COMMENTED"`, agents MUST follow this flowchart:

```mermaid
flowchart TD
    A["Download pr_feedback.json<br/>to .agents/records/reviews/"] --> B["Agent Parses JSON"]
    B --> C["Extract Actionable Items<br/>(File paths + line numbers)"]
    C --> D{"Fix Complexity?"}
    D -->|"Low/Trivial"| E["Fix directly (Amend commit)"]
    D -->|"High/Architectural"| F["Create new Stacked PR<br/>or child ticket"]
    E --> G["Push to update PR"]
    F --> G
    G --> H["Wait for CodeRabbit re-review"]
```

## 3. Extracting Actionable Items

When an agent processes the review file, they must read specific paths:
- Look for `$.reviews[*].body` or `$.comments` for direct feedback.
- Map the feedback directly to files in the worktree (`.worktrees/TK-xxx/`).
- **Evidence Verification**: Do not blindly accept CodeRabbit's suggestions if they violate existing project constraints (e.g., introducing `fs` module into a `Guard`). CodeRabbit can hallucinate. You must verify validity before amending.

## 4. Git Commit Rules for Resolving Reviews

- **Fixes in same branch**: Use standard conventional commits (e.g., `fix(core): resolve CodeRabbit feedback on I/O boundaries`).
- **Stacked PRs**: If the feedback requires a major architectural pivot, do not bloat the original PR. Create a new branch (e.g., `feat/TK-124-refactor` based on `feat/TK-123`) and submit it as a Stacked PR.

## 5. Tone & Assertiveness

CodeRabbit is configured with `profile: assertive`. It will aggressively point out architectural flaws.
- Do NOT ignore "Nitpick comments". Evaluate and fix them if they align with project standards.
- If CodeRabbit requests a change that directly contradicts a `RULE-*.md`, the agent must respond by explaining the rule to CodeRabbit (or instructing a human to reply), rather than breaking AAOS rules to satisfy CodeRabbit.

## 6. Reporting & The HITL Philosophy (Human-in-the-Loop)

*(Aligned with the core `README.md` philosophy: "The system never replaces human judgment.")*

- **DO:** After analyzing CodeRabbit's review, you MUST report back to the user. Provide explicit evidence (e.g., `[CODE]`, `[RUNTIME]`) explaining whether the requested changes are reasonable and align with project constraints.
- **DO NOT:** Silently accept, reject, or push code based on an AI review without providing the rationale to the user. 
- **DO NOT:** Assume AI suggestions overrule human oversight. Always respect that human intuition, perspective, and viewpoint are the ultimate authority in this project.

> Executor: Gemini-CLI
