/**
 * FileTicketProvider — Default zero-infrastructure provider.
 *
 * Reads ticket metadata from a YAML frontmatter file (default: TICKET.md)
 * located in the project root directory.
 *
 * Expected file format:
 *   ---
 *   id: TK-20260408-001
 *   phase: EXECUTING
 *   type: feat
 *   ---
 *   # Ticket Title
 *   Description goes here...
 *
 * Behavior:
 *   - File exists + valid frontmatter → returns enriched TicketRef
 *   - File exists + invalid/empty frontmatter → returns undefined (warn logged)
 *   - File missing → returns undefined (silent, no warning)
 *   - Parse error → returns undefined (warn logged)
 *
 * This provider has ZERO external dependencies beyond what defense-in-depth
 * already ships (`yaml` for YAML parsing, `node:fs` for file I/O).
 */

import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "yaml";
import type { TicketStateProvider } from "./types.js";
import type { TicketRef } from "../core/types.js";

/** Configuration options for FileTicketProvider */
export interface FileProviderConfig {
  /** Path to the ticket metadata file, relative to projectRoot (default: "TICKET.md") */
  ticketFile?: string;
  /** Project root directory — set by the engine, not the user */
  projectRoot?: string;
}

export class FileTicketProvider implements TicketStateProvider {
  readonly name = "file";
  private readonly ticketFile: string;
  private readonly projectRoot: string;

  constructor(config?: FileProviderConfig) {
    this.ticketFile = config?.ticketFile ?? "TICKET.md";
    this.projectRoot = config?.projectRoot ?? process.cwd();
  }

  async resolve(ticketId: string): Promise<TicketRef | undefined> {
    const filePath = path.join(this.projectRoot, this.ticketFile);

    try {
      await access(filePath, constants.R_OK);
      const content = await readFile(filePath, "utf-8");
      const frontmatter = this.parseFrontmatter(content);

      if (!frontmatter) {
        return undefined;
      }

      // Build enriched TicketRef from frontmatter
      const ref: TicketRef = {
        id: typeof frontmatter.id === "string" ? frontmatter.id : (frontmatter.id != null ? String(frontmatter.id) : ticketId),
      };

      if (frontmatter.phase && typeof frontmatter.phase === "string") {
        ref.phase = frontmatter.phase;
      }

      if (frontmatter.type && typeof frontmatter.type === "string") {
        const validTypes = ["feat", "fix", "chore", "docs", "refactor"];
        if (validTypes.includes(frontmatter.type)) {
          ref.type = frontmatter.type as TicketRef["type"];
        }
      }

      return ref;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined; // File missing → silent skip
      }
      
      // Parse or other errors → warn but don't crash
      console.warn(
        `⚠ FileTicketProvider: Failed to read ${this.ticketFile}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  /**
   * Parse YAML frontmatter from file content.
   * Frontmatter is enclosed between --- markers at the start of the file.
   */
  private parseFrontmatter(
    content: string,
  ): Record<string, unknown> | undefined {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match?.[1]) {
      return undefined;
    }

    try {
      const parsed = yaml.parse(match[1]);
      if (typeof parsed !== "object" || parsed === null) {
        return undefined;
      }
      return parsed as Record<string, unknown>;
    } catch {
      console.warn(`⚠ FileTicketProvider: Invalid YAML frontmatter in ${this.ticketFile}`);
      return undefined;
    }
  }
}
