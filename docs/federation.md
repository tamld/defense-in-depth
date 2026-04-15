# Federation Governance Protocol

> **Version**: v0.6.0 — Federation Guards
> **Status**: Stable, opt-in

## Overview

Federation governance enables **parent↔child ticket validation** across projects.
A child project declares its parent ticket, and the guard pipeline enforces
authorization based on the parent's lifecycle phase.

**Use case**: An AAOS parent project spawns a child project (e.g., `defense-in-depth`).
The child must not proceed if the parent ticket is BLOCKED, CANCELLED, or ARCHIVED.

---

## Quick Start

### 1. Configure `defense.config.yml`

```yaml
guards:
  federation:
    enabled: true
    severity: block          # "block" or "warn" (advisory)
    provider: http           # "file" or "http"
    parentEndpoint: "https://parent-project.example.com/api/tickets"
    blockedParentPhases:
      - BLOCKED
      - CANCELLED
      - ARCHIVED
    providerConfig:
      timeout: 3000          # ms, default: 3000
```

### 2. Declare parent in `TICKET.md`

```yaml
---
id: TK-CHILD-001
phase: EXECUTING
parentId: TK-PARENT-001
---
```

### 3. Run verify

```bash
npx defense-in-depth verify
```

If the parent ticket is in a blocked phase, the federation guard will emit a
BLOCK finding and prevent the commit.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              DefendEngine                    │
│                                              │
│  1. extractTicketRef(branch)                 │
│     → { id: "TK-CHILD-001" }                │
│                                              │
│  2. enrichTicketRef(basicRef)                │
│     → provider.resolve("TK-CHILD-001")       │
│     → { id, phase, parentId: "TK-PARENT" }  │
│                                              │
│  3. enrichParentTicket(ticket)               │
│     → parentProvider.resolve("TK-PARENT")    │
│     → ticket.parentPhase = "EXECUTING"       │
│     → ticket.authorized = true               │
│                                              │
│  4. Guard Pipeline                           │
│     → federationGuard.check(ctx)             │
│     → Pure check: reads ctx.ticket only      │
└─────────────────────────────────────────────┘
```

### Key Invariant: Guard Purity

The federation guard performs **ZERO I/O**. All parent state is resolved
during the engine's enrichment phase (steps 2-3) before the guard pipeline
starts. The guard only reads `ctx.ticket.parentPhase` and `ctx.ticket.authorized`.

---

## Providers

### FileTicketProvider (`provider: "file"`)

Reads `TICKET.md` YAML frontmatter from the project root. Zero infrastructure needed.

**Extracted fields**: `id`, `phase`, `type`, `parentId`

```yaml
---
id: TK-20260415-001
phase: EXECUTING
parentId: TK-PARENT-001
---
```

### HttpTicketProvider (`provider: "http"`)

Queries a remote REST endpoint. Uses `globalThis.fetch` (Node 18+) with
`AbortController` for timeout enforcement.

**Endpoint contract**:
```
GET {parentEndpoint}/{ticketId}

Response (200):
{
  "id": "TK-PARENT-001",
  "phase": "EXECUTING",
  "type": "feat"
}

Response (404): Ticket not found → graceful skip
Response (5xx): Server error → graceful degradation (WARN)
Timeout: AbortController fires → graceful degradation (WARN)
```

**Configuration**:
```yaml
guards:
  federation:
    provider: http
    parentEndpoint: "https://api.example.com/tickets"
    providerConfig:
      timeout: 3000  # ms
```

---

## Guard Behavior

| Scenario | Finding | Severity | `passed` |
|----------|---------|----------|----------|
| No `parentId` (standalone project) | None | — | `true` |
| Parent phase EXECUTING | None | — | `true` |
| Parent phase BLOCKED | Phase blocked | Configured | `false`* |
| Parent phase CANCELLED | Phase blocked | Configured | `false`* |
| `authorized: false` | Auth denied | Configured | `false`* |
| Parent unresolvable (404/timeout) | Unresolved parent | WARN | `true` |

\* When `severity: "warn"`, `passed` is always `true` (advisory mode).

### Default Blocked Phases

```
BLOCKED, CANCELLED, ARCHIVED
```

Customizable via `blockedParentPhases` in config. Phase matching is case-insensitive.

---

## Graceful Degradation

Federation follows the **zero-crash principle**:

- **Provider timeout** → WARN finding, pipeline continues
- **Network error** → WARN finding, pipeline continues
- **HTTP 404** → Silent skip (parent not found)
- **HTTP 5xx** → WARN finding, pipeline continues
- **Invalid JSON** → WARN finding, pipeline continues

The guard pipeline is **never blocked** by infrastructure failures.
Only explicit policy violations (blocked phase, denied authorization) produce BLOCKs.

---

## Custom Providers

Implement the `TicketStateProvider` interface for custom ticketing systems
(Jira, Linear, PostgreSQL, etc.):

```typescript
import type { TicketStateProvider } from "defense-in-depth";
import type { TicketRef } from "defense-in-depth";

export class JiraTicketProvider implements TicketStateProvider {
  readonly name = "jira";

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    // Your Jira API logic here
    return { id: ticketId, phase: "IN_PROGRESS", parentId: "PARENT-123" };
  }

  async dispose(): Promise<void> {
    // Cleanup connections
  }
}
```

---

## Testing

Run the federation test suite:

```bash
npm test -- --test-name-pattern="Federation"
```

Test coverage includes:
- 17 unit tests for the federation guard (happy, edge, worst cases)
- 8 unit tests for HttpTicketProvider (including timeout, 404, 500, network error)
- 6 unit tests for FileTicketProvider parentId extraction
- 6 integration tests for the full engine pipeline (FE.01-04)
