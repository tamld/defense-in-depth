# DoD — Documentation Restructuring & GitHub Wiki Initiative

> Definition of Done — the initiative is DONE only when every item below is verified with evidence.
> **Executor**: Gemini-CLI

---

## 1. README & Language Parity Deliverables

- [ ] `README.md` updated, concise (≤ 350 lines), clearly highlighting value prop, quickstart, guard table, and documentation links.
- [ ] `README.vi.md` synchronized 100% with `README.md` using accurate Vietnamese terminology per `rule-translation-glossary.md`.
- [ ] Version indicators consistently display `0.8.0` / current state across both READMEs.

---

## 2. Docs Hub Restructuring Deliverables

- [ ] `docs/index.md` redesigned as a master navigation index covering all 5 pillars:
  1. Getting Started
  2. User Guide
  3. Developer Guide
  4. Ecosystem & Multi-Agent Governance
  5. Vision & Roadmap
- [ ] All broken links resolved across `docs/**` (verified via automated link check script).
- [ ] Missing developer guides filled with high-substance content:
  - `docs/dev-guide/writing-guards.md`
  - `docs/dev-guide/writing-providers.md`
  - `docs/user-guide/hints.md`

---

## 3. GitHub Wiki Deliverables

- [ ] 10 Wiki pages drafted in `wiki/` and ready for deployment:
  1. `Home.md`
  2. `Getting-Started.md`
  3. `Core-Architecture.md`
  4. `Built-in-Guards-Catalog.md`
  5. `CLI-Reference-&-Tooling.md`
  6. `Custom-Guards-&-Plugins.md`
  7. `Federation-&-Cross-Repo-Governance.md`
  8. `Memory-&-Án-Lệ-System.md`
  9. `AI-Agent-Integration-&-Scaffolding.md`
  10. `FAQ-&-Troubleshooting.md`
- [ ] `_Sidebar.md` and `_Footer.md` navigation created.
- [ ] Automated/step-by-step sync instructions provided to push to GitHub Wiki.

---

## 4. Governance & HITL Quality Standards

- [ ] Zero hollow markers (`TODO`, `TBD`, `PLACEHOLDER`) in all committed markdown files (`rule-zero-theater.md`).
- [ ] Every document complies with `rule-document-budget.md` and `rule-flowchart-mandate.md`.
- [ ] All changes partitioned into dedicated GitHub Issues and Pull Requests.
- [ ] No direct commits to `main`; all PRs reviewed and merged with human approval (`rule-hitl-enforcement.md`).
- [ ] All commits follow Conventional Commits format (`type(scope): description`).

---

## 5. Completion Sign-Off Receipt

- **Maintainer Approval**: ____________________
- **Date Completed**: ____________________
- **Final PRs Merged**:
  - PR 1 (Docs Hub): #____
  - PR 2 (README Overhaul): #____
  - PR 3 (Dev Guides): #____
  - PR 4 (Wiki Staging): #____
