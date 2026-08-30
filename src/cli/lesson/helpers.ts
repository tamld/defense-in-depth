export function readFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

export function printLessonUsage(): void {
  console.log(`
🛡️  defense-in-depth lesson — Memory Management

Commands:
  record    Record a new lesson (Án Lệ) into the project memory.
            --file <path>      Load JSON payload from a file
            --data '<js>'      Provide JSON payload inline string
            --quality-gate     Enable DSPy quality evaluation (opt-in, v0.5)

  search    Search existing lessons by keyword or semantic similarity.
            --semantic         Use DSPy semantic ranking (opt-in, v0.5)
            --ticket <TKID>    Optional ticket context for the recall event
            Example: npx defense-in-depth lesson search "git hook"
            Example: npx defense-in-depth lesson search --semantic "pre-commit validation"

  outcome <lessonId> --helpful | --not-helpful
            Record an explicit outcome for a prior recall (issue #23).
            --ticket <TKID>    Disambiguate when many tickets share a lesson
            --recall <id>      Explicit recall id (default: most recent)
            --note "..."       Optional human note (plaintext)

  scan-outcomes
            Walk git history and infer outcomes from commit diffs.
            --since <ref>      Git ref to start from (default: HEAD)
            --max <N>          Hard cap on commits to scan
            --dry-run          Print proposed outcomes without writing
            --dspy             Enable DSPy fuzzy match for lessons without
                                an explicit wrongApproachPattern (opt-in)

  recalls list
            List recorded recall events.
            --lesson <id>      Filter by lessonId
            --ticket <TKID>    Filter by ticketId
            --since <ISO>      Only events at or after this timestamp
            --limit <N>        Cap output count
`);
}
