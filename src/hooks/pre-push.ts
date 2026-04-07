/**
 * Pre-push hook generator.
 *
 * Second defense layer — catches issues that slip past pre-commit.
 * Focuses on branch naming and commit format.
 */

export function generatePrePushHook(): string {
  return `#!/bin/sh
# defend-in-depth pre-push hook
# Auto-generated — do not edit manually.
# To regenerate: npx defend-in-depth init

# Run defend-in-depth verify for push-time checks
npx defend-in-depth verify --hook pre-push

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ Pre-push blocked by defend-in-depth."
  echo "   Fix the issues above, then try again."
  echo ""
  exit 1
fi

exit 0
`;
}
