/**
 * JiraTicketProvider — Atlassian Jira integration provider.
 *
 * Resolves ticket state from Jira REST API.
 * Used when projects use Jira for issue tracking and need federation
 * governance against parent tickets in Jira.
 *
 * Endpoint: https://{domain}.atlassian.net/rest/api/3/issue/{ticketId}
 * Auth: Basic auth (email + API token) or Bearer token
 *
 * Required config:
 *   - baseUrl: "https://{domain}.atlassian.net" (required)
 *   - email: Jira account email (required for basic auth)
 *   - apiToken: Jira API token (required for basic auth)
 *   - Or: bearerToken for OAuth/Bearer auth
 */

import { ProviderError } from "../core/errors.js";
import type { TicketRef } from "../core/types.js";
import type { ProviderConfig, TicketStateProvider } from "./types.js";

/** Configuration options for JiraTicketProvider */
export interface JiraProviderConfig extends ProviderConfig {
  /** Jira base URL (e.g., "https://company.atlassian.net") - required */
  baseUrl?: string;
  /** Jira account email for basic auth */
  email?: string;
  /** Jira API token for basic auth */
  apiToken?: string;
  /** Bearer token for OAuth authentication (alternative to email/apiToken) */
  bearerToken?: string;
  /** Project root directory — set by the engine, not the user */
  projectRoot?: string;
}

/** Jira status category mapping to our phase */
const JIRA_STATUS_TO_PHASE: Record<string, string> = {
  "To Do": "BACKLOG",
  "Backlog": "BACKLOG",
  "Selected for Development": "PLANNING",
  "In Progress": "EXECUTING",
  "In Review": "REVIEW",
  "Done": "COMPLETED",
  "Closed": "COMPLETED",
  "Canceled": "CANCELLED",
  "Cancelled": "CANCELLED",
  "Blocked": "BLOCKED",
  "On Hold": "BLOCKED",
};

export class JiraTicketProvider implements TicketStateProvider {
  readonly name = "jira";
  private readonly baseUrl: string;
  private readonly email: string;
  private readonly apiToken: string;
  private readonly bearerToken: string;
  private readonly timeoutMs: number;

  constructor(config?: JiraProviderConfig) {
    this.baseUrl = config?.baseUrl ?? "";
    this.email = config?.email ?? "";
    this.apiToken = config?.apiToken ?? "";
    this.bearerToken = config?.bearerToken ?? "";
    this.timeoutMs = typeof config?.timeout === "number" ? config.timeout : 5000;

    if (!this.baseUrl) {
      console.warn(`⚠ JiraTicketProvider: baseUrl not configured, provider will fail`);
    }
    if (!this.bearerToken && (!this.email || !this.apiToken)) {
      console.warn(`⚠ JiraTicketProvider: No authentication configured (email+apiToken or bearerToken), provider will fail`);
    }
  }

  private getAuthHeader(): string {
    if (this.bearerToken) {
      return `Bearer ${this.bearerToken}`;
    }
    // Basic auth: email:apiToken
    const credentials = `${this.email}:${this.apiToken}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    if (!this.baseUrl) {
      return undefined;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(ticketId)}?fields=status,parent,issuetype`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": this.getAuthHeader(),
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 404) {
          return undefined;
        }
        const providerErr = new ProviderError(
          `JiraTicketProvider: ${url} returned ${response.status}`,
          this.name,
        );
        console.warn(`⚠ ${providerErr.message}`);
        return undefined;
      }

      const raw: unknown = await response.json();

      if (!raw || typeof raw !== "object") {
        const providerErr = new ProviderError(
          `JiraTicketProvider: Invalid JSON response`,
          this.name,
        );
        console.warn(`⚠ ${providerErr.message}`);
        return undefined;
      }

      const data = raw as Record<string, unknown>;

      // Extract status
      const fields = data.fields as Record<string, unknown> | undefined;
      let phase: string | undefined;
      if (fields) {
        const status = fields.status as Record<string, unknown> | undefined;
        if (status) {
          const statusCategory = status.statusCategory as Record<string, unknown> | undefined;
          if (statusCategory && typeof statusCategory.name === "string") {
            phase = JIRA_STATUS_TO_PHASE[statusCategory.name] ?? statusCategory.name.toUpperCase();
          } else if (typeof status.name === "string") {
            phase = JIRA_STATUS_TO_PHASE[status.name] ?? status.name.toUpperCase();
          }
        }

        // Extract parent
        const parent = fields.parent as Record<string, unknown> | undefined;
        let parentId: string | undefined;
        if (parent && typeof parent.key === "string") {
          parentId = parent.key;
        } else if (parent && typeof parent.id === "string") {
          parentId = parent.id;
        }

        // Extract issue type
        const issuetype = fields.issuetype as Record<string, unknown> | undefined;
        const issueType = issuetype && typeof issuetype.name === "string" ? issuetype.name.toLowerCase() : undefined;

        const ref: TicketRef = {
          id: typeof data.key === "string" ? data.key : ticketId,
        };

        if (phase) {
          ref.phase = phase;
        }

        if (parentId) {
          ref.parentId = parentId;
        }

        // Map Jira issue type to our type
        if (issueType) {
          const typeMap: Record<string, TicketRef["type"]> = {
            story: "feat",
            task: "feat",
            bug: "fix",
            epic: "feat",
            subtask: "chore",
          };
          ref.type = typeMap[issueType] ?? "feat";
        }

        return ref;
      }

      return undefined;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      const reason = isTimeout
        ? `timed out after ${this.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);
      const providerErr = new ProviderError(
        `JiraTicketProvider: Failed to resolve ${ticketId}: ${reason}`,
        this.name,
        err,
      );
      console.warn(`⚠ ${providerErr.message}`);
      return undefined;
    }
  }
}
