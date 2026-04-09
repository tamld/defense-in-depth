# System Design Blueprint: defense-in-depth

> Executor: Gemini-CLI

This document serves as the **Master Architectural Blueprint**, linking all subsystems from the strategic roadmap (v0.1 to v0.8) into a unified, tight-knit diagram. It bridges the gap between scattered concepts and the actual data flow executing under the hood.

---

## 1. Macro Architecture (The Unified Ecosystem)

This diagram visualizes how the physical parts of the system interact, starting from the external Actor down to the internal intelligence and telemetry layers.

```mermaid
flowchart TD
    %% Define Styles
    classDef external fill:#f8fafc,stroke:#94a3b8,stroke-dasharray: 5 5,color:#334155;
    classDef core fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e3a8a,font-weight:bold;
    classDef config fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e;
    classDef mem fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#14532d;
    classDef sync fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d;

    subgraph UserSpace ["👨‍💻 User Space (Trunk: HITL - Supreme Rule)"]
        ACTOR["AI Agent / Human Developer"]:::external
        WORKSPACE["Local Git Worktree<br/>(.worktrees/TK-xxx/)"]:::external
    end

    subgraph CoreEngine ["⚙️ The Engine (Branch 2: Mechanism > Prompting)"]
        HOOK["Git Hooks<br/>(pre-commit, pre-push)"]:::core
        GUARDS["Guard Pipeline<br/>(Sequential Evaluator)"]:::core
        
        HOOK --> GUARDS
    end

    subgraph RuntimeConfig ["📜 Governance Ecosystem"]
        IDENTITY["Identity Resolver<br/>(v0.3)"]:::config
        RULES[".agents/rules/<br/>(Immutable Laws)"]:::config
        ECOSYSTEM["Review Ecosystem<br/>(Agnostic Gateway / HITL)"]:::config
    end

    subgraph MemoryIntelligence ["🧠 Intelligence Subsystem (Branch 3: Growth > Stasis)"]
        MEMORY["Memory Layer (Án Lệ)<br/>(lessons.jsonl)"]:::mem
        DSPY["DSPy Semantic Engine<br/>(Branch 1: Evidence > Plausible) [ROADMAP]"]:::mem
        METRICS["Meta Growth & Recall<br/>(v0.6 - v0.7) [ROADMAP]"]:::mem
        
        MEMORY <--> DSPY
        MEMORY --> METRICS
    end

    subgraph Telemetry ["🌐 OSS Synchronization (v0.8) [ROADMAP]"]
        SYNC["Telemetry Sync<br/>(Bi-directional Bridge)"]:::sync
    end

    %% Wiring it up
    ACTOR -->|Writes Code| WORKSPACE
    WORKSPACE -->|Commits| HOOK
    
    GUARDS -->|1. Validates Identity| IDENTITY
    GUARDS -->|2. Enforces Laws| RULES
    GUARDS -->|3. Review Cycle| ECOSYSTEM
    
    ECOSYSTEM -.->|Friction / Pushback| ACTOR

    GUARDS -->|Extracts Knowledge| MEMORY
    METRICS -->|Aggregates insights| SYNC
```

---

## 2. Decision Flow (The Lifecycle Pipeline)

What actually happens when code moves through defense-in-depth? This decision matrix strictly dictates the sequence of validation and learning.

```mermaid
flowchart TD
    classDef decision fill:#fef08a,stroke:#ca8a04,stroke-width:2px,color:#854d0e;
    classDef success fill:#bbf7d0,stroke:#16a34a,stroke-width:2px,color:#14532d;
    classDef failure fill:#fecaca,stroke:#dc2626,stroke-width:2px,color:#7f1d1d;
    classDef process fill:#e0e7ff,stroke:#4f46e5,stroke-width:1px,color:#1e3a8a;

    START["🏁 Initiate Commit / Finalize"]:::process --> ID_CHECK

    ID_CHECK{"1. Identity Intact?<br/>(Ticket Isolation)"}:::decision
    ID_CHECK -->|No| BL_ID["❌ Reject: Cross-pollution<br/>[Evidence Fallback]"]:::failure
    ID_CHECK -->|Yes| SSOT_CHECK

    SSOT_CHECK{"2. SSoT Safe?<br/>(Mechanism Enforcement)"}:::decision
    SSOT_CHECK -->|No| BL_SSOT["❌ Reject: SSoT Mutation"]:::failure
    SSOT_CHECK -->|Yes| REVIEW_CHECK

    REVIEW_CHECK{"3. External Reviews?<br/>(Trunk: HITL checks)"}:::decision
    REVIEW_CHECK -->|Changes Requested| BL_REV["❌ Reject: Review Blocked"]:::failure
    REVIEW_CHECK -->|Approved / Unchecked| LEARNING_CHECK

    LEARNING_CHECK{"4. Friction Detected?<br/>(Growth Opportunity)"}:::decision
    LEARNING_CHECK -->|Yes| EXTRACT["5. Extract Án Lệ<br/>(Record to Memory)"]:::process
    LEARNING_CHECK -->|No| DSPY_EVAL

    EXTRACT --> DSPY_EVAL

    DSPY_EVAL{"6. Semantic Quality Goal?<br/>(Evidence > Plausible)"}:::decision
    DSPY_EVAL -->|Low Quality| WARN["⚠️ Warn: Hollow Artifact<br/>(Does not block)"]:::failure
    DSPY_EVAL -->|High Quality| PASS

    WARN --> PASS["✅ PASS<br/>Commit Successful"]:::success
```

---

## 3. Structural Roadmap Alignment

How these diagrams align with the published vision in `STRATEGY.md`:

| Roadmap Phase | Location in Diagram | Impact on System |
|:--------------|:--------------------|:-----------------|
| **v0.1 / v0.2** | Core Engine, Rules | Establishes the unbreakable mechanical pipeline. |
| **v0.3** | Identity Resolver | Checks `[Identity Intact?]` to ensure git worktrees aren't polluted. |
| **v0.4** | Memory Layer | `[Extract Lesson]` logic routes successful fixes into `lessons.jsonl`. |
| **v0.5** | DSPy Semantic Engine | The final `[Semantic Quality Goal?]` validation prior to passing a commit. |
| **v0.6 / v0.7** | Metrics / Meta Growth | Analyzes the data stored in the Memory Layer. |
| **v0.8** | Telemetry Sync | Pushes `Meta Growth` stats to external dashboards. |
