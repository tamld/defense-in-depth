/**
 * HttpTicketProvider — Network-aware provider for federation.
 *
 * Resolves ticket state from a remote HTTP endpoint (e.g., parent AAOS project).
 * Used when child projects need to validate authorization against a parent
 * project's ticket system that exposes a REST API.
 *
 * Endpoint contract:
 *   GET {baseUrl}/{ticketId}
 *   Response: { id: string, phase?: string, type?: string }
 *   404 → ticket not found (returns undefined)
 *   Timeout/Error → returns undefined (graceful degradation)
 *
 * This provider uses `globalThis.fetch` (Node 18+), zero external dependencies.
 */

import type { TicketStateProvider, ProviderConfig } from "./types.js";
import type { TicketRef } from "../core/types.js";

/** Configuration options for HttpTicketProvider */
export interface HttpProviderConfig extends ProviderConfig {
  /** Base URL for the ticket API (e.g., "http://localhost:3000/api/tickets") */
  endpoint?: string;
  /** Project root directory — set by the engine, not the user */
  projectRoot?: string;
}

export class HttpTicketProvider implements TicketStateProvider {
  readonly name = "http";
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(config?: HttpProviderConfig) {
    this.endpoint = config?.endpoint ?? "http://localhost:3000/api/tickets";
    this.timeoutMs =
      typeof config?.timeout === "number" ? config.timeout : 3000;
  }

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    const url = `${this.endpoint}/${encodeURIComponent(ticketId)}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 404) {
          return undefined; // Ticket not found — silent skip
        }
        console.warn(
          `⚠ HttpTicketProvider: ${url} returned ${response.status}`,
        );
        return undefined;
      }

      const raw: unknown = await response.json();

      if (!raw || typeof raw !== "object") {
        console.warn(
          `⚠ HttpTicketProvider: Invalid JSON response from ${url}`,
        );
        return undefined;
      }

      const data = raw as Record<string, unknown>;

      const ref: TicketRef = {
        id:
          typeof data.id === "string"
            ? data.id
            : data.id != null
              ? String(data.id)
              : ticketId,
      };

      if (data.phase && typeof data.phase === "string") {
        ref.phase = data.phase;
      }

      if (data.type && typeof data.type === "string") {
        const validTypes = ["feat", "fix", "chore", "docs", "refactor"];
        if (validTypes.includes(data.type)) {
          ref.type = data.type as TicketRef["type"];
        }
      }

      // v0.6: Extract parentId for federation governance
      if (data.parentId && typeof data.parentId === "string") {
        ref.parentId = data.parentId;
      } else if (data.parentId != null && data.parentId !== "") {
        ref.parentId = String(data.parentId);
      }

      return ref;
    } catch (err) {
      // AbortError = timeout, TypeError = network failure
      const isTimeout =
        err instanceof Error && err.name === "AbortError";
      const reason = isTimeout
        ? `timed out after ${this.timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);
      console.warn(`⚠ HttpTicketProvider: Failed to resolve ${ticketId}: ${reason}`);
      return undefined;
    }
  }
}
