# Agent Contract: Guard Interface

> **For Agents:** This document outlines the constraints and expected behavior when developing new Guards.

A `Guard` in `defense-in-depth` evaluates context passed by the hook engine and returns zero or more `Finding` objects. Findings dictate if the commit/push is allowed across our Pass, Warn, Block taxonomy.

## Macro Concept

Where [Providers](./provider-interface.md) are "dirty" and "slow", Guards are **"pure"** and **"fast"**. Guards never make asynchronous calls, nor do they look up external APIs.

## Mandatory Constraints

1. **Synchronous ONLY**: Guards must strictly output an Array. Functions may only be declared as synchronous.
2. **Pure Functions ONLY**: 
    - A Guard MUST NOT perform I/O.
    - A Guard MUST NOT spawn shells, use network `fetch`, or read from `fs`.
    - If a Guard requires data (such as the content of `TICKET.md`), that data must be supplied via the `HookContext`, enriched by a Provider.
3. **No Mutating Scope**: Never mutate the `HookContext`.

## Code Definition Reference

```typescript
export interface Guard {
  id: string;
  name: string;
  isEnabled: boolean;
  evaluate(context: HookContext): Finding[];
}
```

Findings must resolve to standard severities `PASS`, `WARN`, or `BLOCK`.
Guard implementations reside in `src/guards/`.
