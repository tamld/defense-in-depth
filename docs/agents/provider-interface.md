# Agent Contract: TicketStateProvider Interface

> **For Agents:** This document outlines the constraints and expected behavior when dealing with Providers.

A `TicketStateProvider` runs **first** during the hook lifecycle to enrich the ticket context.

## Mandatory Constraints

1. **Async and Network Safe**: Providers are the **ONLY** layer in `defense-in-depth` authorized to do asynchronous or side-effectual read operations (reading files, calling remote endpoints).
2. **Crash Prevention**: Providers operate at the perimeter. They must wrap external interactions in `try/catch`. 
3. **Graceful Failures**: If network is down, or `TICKET.md` is malformed, do NOT throw an Error. Return `undefined`.
4. **Timeouts**: Because hook execution blocks git commands, API providers must enforce their own strict timeouts (using `Promise.race`) falling back to `undefined` if resolution takes more than a small threshold (e.g. `1000ms`).
5. **No State Mutation**: Providers resolve state. You must not write files or change records inside a resolving method.

## Code Definition Reference

```typescript
export interface TicketStateProvider {
  name: string;
  resolve(ticketId: string): Promise<TicketRef | undefined>;
}
```

Implementations must reside inside `src/federation/` and be exported and registered inside `src/federation/index.ts`.
