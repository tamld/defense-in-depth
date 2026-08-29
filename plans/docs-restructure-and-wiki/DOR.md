# DoR — Documentation Restructuring & GitHub Wiki Initiative

> Definition of Ready — conditions that must hold BEFORE implementation waves start.
> Any unchecked item = initiative is NOT ready for execution.
> **Executor**: Gemini-CLI

---

## 1. Planning Artifacts & Baseline Audits

- [x] Baseline documentation inventory completed across `README.md`, `README.vi.md`, `docs/`, and `.agents/`.
- [x] Version drift identified: `package.json` at `0.8.0` while some docs mention `v0.7.0` or `v0.3`.
- [x] GitHub Wiki status verified: `hasWikiEnabled: true`, 0 remote pages initialized.
- [x] PRD, DoR, DoD, ADR drafted and placed in `plans/docs-restructure-and-wiki/`.

---

## 2. Key Decisions (Maintainer Sign-Off Received)

- [x] **D1: README Target & Tone**: Agree on cutting down README to ≤350 lines, focusing on product pitch, quickstart, guard overview, and routing to `docs/` and Wiki.
- [x] **D2: Wiki Architecture**: Approved 10-page Wiki layout (`Home`, `Getting-Started`, `Core-Architecture`, `Built-in-Guards`, `CLI-Reference`, `Custom-Guards`, `Federation`, `Memory-System`, `AI-Agent-Integration`, `FAQ`).
- [x] **D3: Staging Repository Structure**: Approved placing Wiki drafts in `wiki/` directory locally to ease review before pushing to `.wiki.git`.
- [x] **D4: HITL Enforcement**: Approved wave-by-wave execution with dedicated feature branches and PRs (zero direct push to `main`). GitHub Issues created: #86, #87, #88, #89.

---

## 3. Environment & Tooling Verification

- [x] Node.js ≥ 18 and `pnpm` / `npm` available.
- [x] `gh` CLI authenticated and operational for creating issues and PRs.
- [x] Markdown linting and link integrity checks identified.

---

**Ready ⇔ All sections checked.** Wave 1 will begin immediately upon maintainer approval of D1–D4.
