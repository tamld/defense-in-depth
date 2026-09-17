/**
 * LinearTicketProvider — Linear (linear.app) integration provider.
 *
 * Resolves ticket state from Linear GraphQL API.
 * Used when projects use Linear for issue tracking and need federation
 * governance against parent tickets in Linear.
 *
 * Endpoint: https://api.linear.app/graphql
 * Auth: Linear API key (personal or OAuth)
 *
 * Required config:
 *   - endpoint: "https://api.linear.app/graphql" (default)
 *   - apiKey: Linear API key (required)
 *   - teamId: Linear team ID (required for project-scoped queries)
 *
 * Query: issue(id: $id) { id, identifier, state { name }, parent { id, identifier, state { name } } }
 */

import { ProviderError } from "../core/errors.js";
import type { TicketRef } from "../core/types.js";
import type { ProviderConfig, TicketStateProvider } from "./types.js";

/** Configuration options for LinearTicketProvider */
export interface LinearProviderConfig extends ProviderConfig {
  /** Linear GraphQL endpoint (default: "https://api.linear.app/graphql") */
  endpoint?: string;
  /** Linear API key (personal or OAuth) - required */
  apiKey?: string;
  /** Linear team ID for project-scoped queries - required */
  teamId?: string;
  /** Project root directory — set by the engine, not the user */
  projectRoot?: string;
}

/** GraphQL query to fetch issue with parent */
const LINEAR_ISSUE_QUERY = `
  query GetIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      state { name }
      parent { id identifier state { name } }
    }
  }
`;

export class LinearTicketProvider implements TicketStateProvider {
  readonly name = "linear";
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly teamId: string;
  private readonly timeoutMs: number;

  constructor(config?: LinearProviderConfig) {
    this.endpoint = config?.endpoint ?? "https://api.linear.app/graphql";
    this.apiKey = config?.apiKey ?? "";
    this.teamId = config?.teamId ?? "";
    this.timeoutMs = typeof config?.timeout === "number" ? config.timeout : 5000;

    if (!this.apiKey) {
      console.warn(`⚠ LinearTicketProvider: apiKey not configured, provider will fail`);
    }
    if (!this.teamId) {
      console.warn(`⚠ LinearTicketProvider: teamId not configured, provider may fail`);
    }
  }

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    if (!this.apiKey || !this.teamId) {
      return undefined;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.apiKey,
        },
        body: JSON.stringify({
          query: LINEAR_ISSUE_QUERY,
          variables: { id: ticketId },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        const providerErr = new ProviderError(
          `LinearTicketProvider: ${this.endpoint} returned ${response.status}`,
          this.name,
        );
        console.warn(`⚠ ${providerErr.message}`);
        return undefined;
      }

      const raw: unknown = await response.json();

      if (!raw || typeof raw !== "object" || !("data" in raw)) {
        const providerErr = new ProviderError(
          `LinearTicketProvider: Invalid GraphQL response`,
          this.name,
        );
        console.warn(`⚠ ${providerErr.message}`);
        return undefined;
      }

      const data = raw as { data?: { issue?: unknown } };
      const issue = data.data?.issue;

      if (!issue || typeof issue !== "object") {
        return undefined;
      }

      const issueData = issue as Record<string, unknown>;

      // Map Linear state to our phase
      const state = issueData.state as Record<string, unknown> | undefined;
      const phase = state && typeof state.name === "string" ? state.name.toUpperCase() : undefined;

      // Extract parent info
      const parent = issueData.parent as Record<string, unknown> | undefined;
      let parentId: string | undefined;
      if (parent && typeof parent.id === "string") {
        parentId = parent.id;
      }

      const ref: TicketRef = {
        id: typeof issueData.identifier === "string" ? issueData.identifier : ticketId,
      };

      if (phase) {
        ref.phase = phase;
      }

      if (parentId) {
        ref.parentId = parentId;
      }

      // Map Linear issue type
      if (issueData.identifier && typeof issueData.identifier === "string") {
        // Linear identifiers are like "TEAM-123"
        // Type inference from identifier prefix is not reliable, skip
      }

      return ref;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const reason = isTimeout
        ? `timed out after ${this.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);
      const providerErr = new ProviderError(
        `LinearTicketProvider: Failed to resolve ${ticketId}: ${reason}`,
        this.name,
        err,
      );
      console.warn(`⚠ ${providerErr.message}`);
      return undefined;
    }
  }
}
