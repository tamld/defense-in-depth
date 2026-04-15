---
id: DEV-GUIDE-TEST-QUALITY
status: active
version: 1.0.0
scope: internal-development-strategy
---

# Test Quality Checklist

> **Scope**: This checklist applies to ALL test PRs in defense-in-depth,
> regardless of author (Human, Main Agent, or Jules). It is an internal
> development standard, not a requirement for DiD package users.

## PR Review Checklist

### Assertion Quality

- [ ] Tests use **behavioral assertions** — assert error types, return values, state changes
- [ ] No snapshot matching (`toMatchSnapshot()`) for logic tests
- [ ] No literal string matching for dynamic outputs

### Mock Discipline

- [ ] **ALL** external dependencies are mocked (fetch, fs, Redis, DB, timers)
- [ ] No partial mocking — mock the entire dependency or nothing
- [ ] Each test file has a `// Dependencies: [...]` audit comment
- [ ] All `vi.mock()` / `jest.mock()` targets exist in current source (no ghost mocks)

### Coverage Depth

- [ ] **Mutation test**: Removing one line of source logic causes at least one test to fail
- [ ] Edge cases are covered: null, undefined, empty string, boundary values, error paths
- [ ] Async error paths are tested (rejected promises, thrown errors)
- [ ] Timeout/abort scenarios are tested where applicable

### Provider Parity (when testing interface implementations)

- [ ] Tests feed a **fully-populated** object with ALL fields set
- [ ] Tests assert 100% of fields survive round-trip (serialize → deserialize)
- [ ] All providers implementing the same interface have equivalent test coverage

### Blast Radius Awareness

- [ ] When source code is refactored, corresponding test mocks are updated
- [ ] Renamed/removed services → grep `vi.mock("...service...")` for stale references
- [ ] Interface field additions → check all provider tests cover the new field

## Quick Decision Tree

```text
Is this a test PR?
├─ YES: Apply full checklist above
│   ├─ Author is Jules? → Extra scrutiny on mock completeness + assertion depth
│   └─ Author is Human/Main Agent? → Standard checklist
└─ NO: Standard code review process
```

## Evidence Base

This checklist is backed by PROVEN lessons (confidence 0.95):

1. **LLM Happy Path Complacency** — LLMs write tests that pass but don't catch real regressions
2. **Ghost Mock Epidemic** — Refactored services leave orphan mocks that silently pass
3. **Interface Drift Silent Failure** — TypeScript structural typing allows providers to silently drop optional fields
4. **Partial Mock Trap** — Mocking one dependency but forgetting deeper transitive deps causes false passes
