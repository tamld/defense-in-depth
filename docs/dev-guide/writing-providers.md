# Writing Custom Providers

If the default `file` provider does not meet your needs (e.g. you want to fetch ticket status from Jira, Linear, or a complex external database), you can write a custom `TicketStateProvider`.

## The `TicketStateProvider` Interface

All providers must implement the `TicketStateProvider` interface:

```typescript
export interface TicketStateProvider {
  /** 
   * Name of the provider. Used in `defense.config.yml`.
   */
  name: string;

  /**
   * Resolves context about a ticket given its ID.
   * 
   * @param ticketId - The ID of the ticket to look up.
   * @returns A promise resolving to a TicketRef or undefined if not found/error.
   */
  resolve(ticketId: string): Promise<TicketRef | undefined>;
}
```

## Creating a Provider

Here is an example custom provider that fetches ticket identities from an external JSON API:

```typescript
import type { TicketStateProvider, TicketRef, ProviderConfig } from "defense-in-depth";

export class ApiTicketProvider implements TicketStateProvider {
  readonly name = "myApi";
  private endpoints: string;

  constructor(config?: ProviderConfig) {
    this.endpoints = config?.providerConfig?.endpoint ?? "https://api.mycompany.com/tickets";
  }

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    try {
      const response = await fetch(`${this.endpoints}/${ticketId}`);
      if (!response.ok) return undefined;

      const data = await response.json();
      
      return {
        id: data.id,
        phase: data.status,
        type: data.team === 'docs' ? 'docs' : 'feat'
      };
    } catch {
      // Providers must NOT throw exceptions! They should gracefully absorb errors and return undefined.
      console.warn(`[myApi] Failed to fetch ticket ${ticketId}`);
      return undefined;
    }
  }
}
```

## Contract Rules

When developing custom providers, you must adhere to the **Provider Contract**:

1. **Graceful Failures**: I/O is inherently unsafe. Do not throw exceptions, as it will crash the git hook. `catch` all asynchronous errors and return `undefined` with a simple warning.
2. **Speed & Timeout**: Since hooks block developers from committing/pushing, providers must be fast. `defense-in-depth` wrappers invoke your hook with a default global timeout.
3. **No Side-Effects**: Your `resolve` function should only read data, not modify external systems or file states.

## Wiring Up The Custom Provider

**Note**: In `v0.3.x`, dynamically loaded custom providers are still experimental. Built-in providers (like the `file` provider) ship with the engine. Future versions will support `defense-in-depth` scanning for custom `.js` provider classes based on configuration.
