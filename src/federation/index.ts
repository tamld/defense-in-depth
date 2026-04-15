/**
 * Federation module — Provider factory and barrel export.
 *
 * Creates a TicketStateProvider from defense.config.yml configuration.
 * Built-in providers:
 *   - "file" → FileTicketProvider (reads TICKET.md YAML frontmatter)
 *   - "http" → HttpTicketProvider (queries remote REST endpoint)
 *
 * Users can implement custom providers for their own ticketing systems
 * (PostgreSQL, Jira, Linear, etc.) by implementing TicketStateProvider.
 */

import { FileTicketProvider } from "./file-provider.js";
import { HttpTicketProvider } from "./http-provider.js";
import type { TicketStateProvider, ProviderConfig } from "./types.js";

/**
 * Create a TicketStateProvider from config values.
 *
 * @param provider - Provider type: "file" (default), "http", or a custom identifier
 * @param providerConfig - Provider-specific configuration (passed to constructor)
 * @param projectRoot - Project root directory (injected by engine)
 * @returns A TicketStateProvider instance
 */
export function createProvider(
  provider: string | undefined,
  providerConfig?: ProviderConfig,
  projectRoot?: string,
): TicketStateProvider {
  const config = { ...providerConfig, projectRoot };

  switch (provider) {
    case undefined:
    case "file":
      return new FileTicketProvider(config);

    case "http":
      return new HttpTicketProvider(config);

    default:
      // Future: dynamic import for custom providers
      console.warn(
        `⚠ Unknown ticket provider "${provider}", falling back to "file" provider.`,
      );
      return new FileTicketProvider(config);
  }
}

// Barrel exports
export type { TicketStateProvider, ProviderConfig } from "./types.js";
export { FileTicketProvider } from "./file-provider.js";
export { HttpTicketProvider } from "./http-provider.js";
