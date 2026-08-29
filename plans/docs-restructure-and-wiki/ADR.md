# ADR — Documentation Restructuring & GitHub Wiki Initiative

> Architecture Decision Records for documentation structure and wiki management.  
> **Status**: ALL PROPOSED (awaiting maintainer sign-off) · **Date**: 2026-08-29  
> **Executor**: Gemini-CLI

---

## ADR-0001: Documentation Hub Hierarchy (5-Pillar Architecture)

### Context
`docs/` has grown to 27+ markdown files across various directories (`user-guide/`, `dev-guide/`, `vision/`, `migration/`, `agents/`, `goals/`). The root `docs/index.md` only exposes a small fraction of these documents, leading to discoverability friction for both humans and AI agents.

### Decision
Structure `docs/` and `docs/index.md` around 5 clear functional pillars:
1. **Getting Started**: Quickstart, Installation, CI/CD GitHub Action setup.
2. **User Guide**: Configuration schema, CLI command catalog, Built-in guards, Providers, Hints.
3. **Developer Guide**: Engine architecture, writing pure guards, provider interfaces, DSPy integration, fail-fast policies, testing checklists.
4. **Ecosystem & Multi-Agent Governance**: `.agents/` layout, Agent Workspace guidelines, AI coordination procedures, HITL enforcement.
5. **Vision & Roadmap**: Meta-architecture, system blueprints, SemVer stability, migration guides.

### Consequences
- Easy lazy-loading for agents.
- Clear mental model for human developers.

---

## ADR-0002: README Streamlining Strategy (Progressive Disclosure)

### Context
`README.md` and `README.vi.md` currently span ~630 lines, mixing quickstart instructions, deep philosophical explanations, an exhaustive built-in guard table, architecture diagrams, social infographics, and deep internal roadmap/milestone logs from earlier sprints. This creates cognitive overload.

### Decision
Refactor `README.md` (and `README.vi.md`) following the **Progressive Disclosure** pattern:
- **Hero & Mission**: Catchy value proposition ("Git-based governance middleware for AI coding agents").
- **Visual Workflow**: Mermaid diagram + quick explanation.
- **60-Second Quickstart**: `init`, `doctor`, `verify`.
- **Built-in Guards Table**: Clean summary of the 9 guards, default state, severity, and hook triggers.
- **Progressive Links**: Direct deep links to `docs/` and GitHub Wiki for comprehensive configuration, custom guard authoring, and vision roadmap.
- **Size Budget**: Target ≤ 350 lines per README.

### Consequences
- Much faster onboarding for new users.
- Reduced maintenance burden when internal implementation details change.

---

## ADR-0003: GitHub Wiki Staging & Sync Architecture

### Context
GitHub Wiki repositories are distinct Git repositories (`<repo>.wiki.git`). Editing wiki pages directly in GitHub's web interface causes drift with local repository documentation and prevents automated linting, spell-checking, and review workflows.

### Decision
1. Maintain a local staging directory `wiki/` containing all Markdown pages with exact GitHub Wiki formatting (`_Sidebar.md`, `_Footer.md`, etc.).
2. Track and review wiki updates via standard Git PRs in the main repo.
3. Provide a simple sync script / instructions (`scripts/sync-wiki.sh` or `git subtree` / push command) to push `wiki/` markdown files to `https://github.com/tamld/defense-in-depth.wiki.git`.

### Consequences
- Wiki content is version-controlled, linted, and reviewed before publishing.
- Zero risk of accidental wiki overwrites.

---

## ADR-0004: Execution Partitioning into Issues and PRs

### Context
Per `rule-hitl-enforcement.md` and `procedure-task-execution.md`, all changes must be transparent, reviewable, and never committed directly to `main`.

### Decision
Divide this initiative into 4 discrete GitHub Issues and PRs:
- **Issue 1 / PR 1**: `docs(hub): restructure docs/ directory and overhaul docs/index.md` (Branch: `docs/restructure-hub`)
- **Issue 2 / PR 2**: `docs(readme): streamline README.md & README.vi.md to v0.8.0 specification` (Branch: `docs/streamline-readme`)
- **Issue 3 / PR 3**: `docs(guides): complete missing developer guides and provider docs` (Branch: `docs/complete-guides`)
- **Issue 4 / PR 4**: `docs(wiki): author 10-page GitHub Wiki knowledge base and sync tooling` (Branch: `docs/github-wiki`)

### Consequences
- Atomic, bisectable PRs.
- Clear CodeRabbit and human review checkpoints.
