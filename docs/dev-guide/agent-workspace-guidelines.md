# Agent Workspace Guidelines 

> **Goal**: To prevent "Ecosystem Pollution" where agents scatter scripts, configuration files, and drafts indiscriminately at the project root.

AI Agents operate autonomously and often need places to generate test scripts, record intermediate reasoning, or create data dumps. This document serves as the **Definitive Guiding Map** for agents to place their files correctly.

## ⛔ The Root Directory is Restricted
By the **Root Pollution Guard**, you are strictly **blocked** from committing files to the `/` root directory unless they are explicitly authorized in `defense.config.yml`. 

*Do NOT place temporary scripts (e.g., `test.js`), API logs, or markdown drafts in the root folder.*

## ✅ Where to Place Your Files

If you need to create a file, use this decision matrix:

| What you are trying to do | Where it belongs | Will it be tracked by Git? |
|---------------------------|------------------|---------------------------|
| **1. Brainstorming / Drafts / Memory** | `.gemini/brain/`, `.claude/`, `.cursor/`, or `/tmp/` | ❌ Gitignored. Perfect for private, messy scratchpads. |
| **2. One-off Test Scripts** | `<target-directory>/` or `.gemini/scratch/` | ❌ Gitignored. Safe to run without worrying about pollution. |
| **3. Project Documentation** | `docs/dev-guide/` or `docs/user-guide/` | ✅ Tracked. Write clear markdown for human developers. |
| **4. Architectural Blueprints** | `docs/vision/` | ✅ Tracked. Used for system design planning. |
| **5. AI Rules & Governance** | `.agents/rules/` | ✅ Tracked. Immutable laws that all AI agents must follow. |
| **6. AI Workflows (SOPs)** | `.agents/workflows/` | ✅ Tracked. Operational procedures for tasks. |
| **7. Source Code & Logic** | `src/` (TypeScript) | ✅ Tracked. The actual application code. |
| **8. Automated Tests** | `tests/` | ✅ Tracked. Validation suites. |

## Why not just rely on `.gitignore`?
`.gitignore` hides files from Git, but it does NOT hide them from other developers or agents looking at the file tree. Dumping 20 `.js` test scripts at the project root clutters the tree, leading to Context Rot when reading `ls -la`.

By forcing physical separation, we maintain a pristine project ecosystem.

## How to recover if blocked by the Root Pollution Guard?
If you try to commit a file like `root_test_script.js` and the Guard blocks you:
1. Don't panic.
2. Run exactly what the `Fix` suggestion says:
   `git reset HEAD "root_test_script.js"`
3. Move the file:
   `mv "root_test_script.js" <target-directory>/root_test_script.js`
4. Stage the other files and re-commit!
