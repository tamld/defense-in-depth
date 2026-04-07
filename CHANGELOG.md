# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Core engine with pluggable guard pipeline (`src/core/engine.ts`)
- Type-safe guard interface with `Guard`, `GuardResult`, `Finding` types
- YAML config loader with deep merge defaults (`src/core/config-loader.ts`)
- 5 built-in guards:
  - `hollow-artifact` — detects files with only TODO/TBD placeholders
  - `ssot-pollution` — blocks governance/config files from feature PRs
  - `commit-format` — enforces conventional commit messages
  - `branch-naming` — validates branch name patterns
  - `phase-gate` — requires plan files before code commits
- CLI with 3 commands: `init`, `verify`, `doctor`
- Git hook generators (pre-commit, pre-push)
- Project self-awareness layer (`AGENTS.md`)
- Immutable consistency rules (`.agents/rules/`)
- Dual-audience README (human + AI agent)
- OSS standard files (LICENSE, CONTRIBUTING, CHANGELOG)
