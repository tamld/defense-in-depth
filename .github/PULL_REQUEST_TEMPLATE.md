## Description

<!-- What does this PR do? Link the related issue if any. -->

Fixes #

## Type of Change

- [ ] 🐛 Bug fix (non-breaking)
- [ ] ✨ New feature (non-breaking)
- [ ] 🛡️ New guard
- [ ] 💥 Breaking change
- [ ] 📝 Documentation only
- [ ] 🔧 Refactor (no behavior change)

## Checklist

- [ ] My code follows the [consistency rules](.agents/rules/rule-consistency.md)
- [ ] I used conventional commit format for the PR title
- [ ] I added tests for new functionality
- [ ] All existing tests pass (`npm test`)
- [ ] I updated documentation (README, CHANGELOG) if needed
- [ ] New guards implement the `Guard` interface from `core/types.ts`
- [ ] No `any` types used
- [ ] No new external dependencies added

## For New Guards Only

- [ ] Guard is a pure function (no side effects)
- [ ] Guard is registered in `guards/index.ts`
- [ ] Guard config type added to `core/types.ts`
- [ ] Guard completes in <100ms for typical workloads
- [ ] BLOCK findings include `fix` suggestions

## Evidence

<!-- How did you verify this works? Paste terminal output, screenshots, etc. -->

```
$ npm test
...
```
