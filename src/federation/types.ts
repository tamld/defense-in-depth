/**
 * Federation Types — Provider contract for pluggable ticket state resolution.
 *
 * Providers are NOT guards. They are context enrichment adapters that run
 * BEFORE the guard pipeline. Unlike guards, providers:
 *   - MAY make network/file I/O
 *   - MAY be non-deterministic (external state changes)
 *   - MUST handle their own errors (return undefined, never throw to caller)
 *   - SHOULD complete within reasonable time (timeout enforcement happens in engine)
 *   - SHOULD cache results when appropriate
 *
 * This separation preserves the Guard Interface Contract:
 *   "Guards MUST NOT make network requests" (Invariant #1)
 *   "Same input → same output, always" (Invariant #5)
 *
 * The engine orchestrates: load config → create provider → enrich context → run guards.
 */

import type { TicketRef } from "../core/types.js";

/**
 * Base configuration for any TicketStateProvider.
 */
export interface ProviderConfig {
  /** Maximum time in milliseconds to wait for provider resolution (default: 5000) */
  timeout?: number;
  [key: string]: unknown;
}

/**
 * A TicketStateProvider resolves ticket metadata from an external source.
 *
 * Built-in providers:
 *   - "file" → FileTicketProvider (reads TICKET.md YAML frontmatter)
 *
 * Users can implement custom providers for their own ticketing systems
 * (PostgreSQL, Jira, Linear, etc.) by implementing this interface.
 */
export interface TicketStateProvider {
  /** Provider identifier (e.g., "file", "postgres") */
  readonly name: string;

  /**
   * Resolve ticket state by ID.
   *
   * @param ticketId - The ticket identifier extracted from branch/commit/directory
   * @returns Enriched TicketRef with phase/metadata, or undefined if not resolvable.
   *          Returning undefined causes the guard to skip phase-aware checks gracefully.
   */
  resolve(ticketId: string): Promise<TicketRef | undefined>;

  /**
   * Optional cleanup for connections/resources.
   * Called once after all guards have completed their run.
   */
  dispose?(): Promise<void>;
}

// Re-export TicketRef for provider implementors
export type { TicketRef } from "../core/types.js";
