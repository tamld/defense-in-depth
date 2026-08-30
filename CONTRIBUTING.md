# Contributing to defense-in-depth

Thank you for your interest in contributing to **defense-in-depth** (DiD)!

defense-in-depth is an open-source governance middleware that validates code and artifacts using Git hooks and progressive intelligence pipelines before changes reach Git history. We welcome contributions from human engineers and AI coding agents operating under human direction.

> 🌐 **Language**: [Tiếng Việt (Vietnamese)](CONTRIBUTING.vi.md) | **English**
> 🤖 **AI Agents**: If you are an automated AI agent, please load [AGENTS.md](AGENTS.md) and [.agents/AGENTS.md](.agents/AGENTS.md) first.

---

## 📋 Table of Contents

1. [Development Setup](#-development-setup)
2. [Running Tests & Coverage Gate](#-running-tests--coverage-gate)
3. [Commit Conventions](#-commit-conventions)
4. [Branch Naming](#-branch-naming)
5. [Pull Request Workflow](#-pull-request-workflow)
6. [Writing Custom Guards](#-writing-custom-guards)
7. [AI Collaboration & HITL Policy](#-ai-collaboration--hitl-policy)
8. [Security Reporting](#-security-reporting)

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **pnpm** (recommended) or **npm**: `>= 9.0.0`
- **Git**: `>= 2.30.0`

### Initializing the Workspace

```bash
# 1. Clone the repository
git clone https://github.com/tamld/defense-in-depth.git
cd defense-in-depth

# 2. Install dependencies
pnpm install # or npm install

# 3. Build TypeScript sources
npm run build

# 4. Initialize defense-in-depth hooks locally
npx defense-in-depth init
```

---

## 🧪 Running Tests & Coverage Gate

Every contribution must pass the full test suite and strict coverage threshold before merging.

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode during active development
npm run test:watch

# Verify strict coverage thresholds (Line >= 98%, Branch >= 91%, Funcs >= 97%)
npm run coverage

# Perform TypeScript strict type-check
npm run lint
```

---

## 💬 Commit Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/) format for all commits:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Allowed Types
- `feat`: New user-facing feature or guard
- `fix`: Bug fix in runtime or CLI logic
- `refactor`: Code changes that neither fix a bug nor add a feature
- `test`: Adding or correcting tests
- `docs`: Documentation changes only
- `chore`: Tooling, script, or configuration updates

### Examples
- `feat(guards): add AST-based secret scanning guard (#42)`
- `fix(cli/lesson): resolve type narrowing error in record subcommand (#102)`
- `docs(root): add CONTRIBUTING.md for human contributors (#107)`

---

## 🌿 Branch Naming

Use the standard naming scheme for branches:

| Branch Pattern | Purpose | Example |
|:---|:---|:---|
| `feat/<feature-name>` | New capabilities or guards | `feat/ticket-identity-guard` |
| `fix/<bug-name>` | Bug fixes | `fix/cli-enum-cast` |
| `refactor/<target>` | Structural refactoring | `refactor/split-lesson-cli` |
| `test/<test-scope>` | Test additions / hardening | `test/hints-emit-compound` |
| `docs/<topic>` | Documentation updates | `docs/contributing-guide` |

---

## 🔄 Pull Request Workflow

1. **Create a topic branch** from `main`.
2. **Implement changes** cleanly following TypeScript strict rules (no `any` casts).
3. **Verify locally**:
   ```bash
   npm run build
   npm run lint
   npm test
   npm run coverage
   ```
4. **Push your branch** and open a Pull Request against `main`.
5. **PR Checklist**:
   - [ ] Clear description linking related issues (`Closes #123`).
   - [ ] All tests pass without weakening assertions.
   - [ ] No SSoT files committed (enforced by `ssotPollution` guard).
   - [ ] No hollow placeholder artifacts (`TODO`/`TBD`/`PLACEHOLDER`).

---

## 🛡️ Writing Custom Guards

Guards are the core extensibility pillar of defense-in-depth. Every guard implements the pure `Guard` interface.

- Read the full guard development guide: [Writing Custom Guards](docs/dev-guide/writing-guards.md)
- Ensure your guard is pure: no network requests, no filesystem mutation, deterministic outputs.
- Test your guard against positive cases, negative controls, and adversarial bypass attempts.

---

## 🤖 AI Collaboration & HITL Policy

defense-in-depth is designed for the era of Human-in-the-Loop (HITL) AI-assisted development:

- **AI Agents**: Autonomous agents (Gemini, Claude, Jules) must adhere to the rules in [AGENTS.md](AGENTS.md) and [.agents/rules/](.agents/rules/).
- **Human Authority**: No AI agent has unilateral merge authority. Human review is supreme.

---

## 🔒 Security Reporting

If you discover a security vulnerability within defense-in-depth, please **do not open a public issue**. Instead, report it privately via GitHub Security Advisories or by contacting the maintainers directly.

---

Thank you for helping make AI-assisted engineering safer and more resilient!
