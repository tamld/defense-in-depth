/**
 * Federation module — Provider factory and barrel export.
 *
 * Creates a TicketStateProvider from defense.config.yml configuration.
 * Currently ships with one built-in provider:
 *   - "file" → FileTicketProvider (reads TICKET.md YAML frontmatter)
 *
 * Future providers (postgres, jira, etc.) can be added here or loaded
 * dynamically from user-supplied module paths.
 */

import { FileTicketProvider } from "./file-provider.js";
import type { TicketStateProvider, ProviderConfig } from "./types.js";

/**
 * Create a TicketStateProvider from config values.
 *
 * @param provider - Provider type: "file" (default) or a future custom identifier
 * @param providerConfig - Provider-specific configuration (passed to constructor)
 * @param projectRoot - Project root directory (injected by engine)
 * @returns A TicketStateProvider instance, or undefined if provider is explicitly disabled
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

    default:
      // Future: dynamic import for custom providers
      // For now, fall back to file provider with a warning
      console.warn(
        `⚠ Unknown ticket provider "${provider}", falling back to "file" provider.`,
      );
      return new FileTicketProvider(config);
  }
}

// Barrel exports
export type { TicketStateProvider, ProviderConfig } from "./types.js";
export { FileTicketProvider } from "./file-provider.js";
