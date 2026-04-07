/**
 * Pre-commit hook generator.
 *
 * Generates a bash script that calls `defend-in-depth verify`
 * on staged files before allowing the commit.
 */

export function generatePreCommitHook(): string {
  return `#!/bin/sh
# defend-in-depth pre-commit hook
# Auto-generated — do not edit manually.
# To regenerate: npx defend-in-depth init

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Run defend-in-depth verify on staged files
npx defend-in-depth verify --hook pre-commit --files $STAGED_FILES

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Pre-commit blocked by defend-in-depth."
  echo "   Fix the issues above, then try again."
  echo ""
  exit 1
fi

exit 0
`;
}
