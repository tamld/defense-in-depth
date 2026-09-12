/**
 * Guards barrel export — all built-in guards in one place.
 */

export { branchNamingGuard } from "./branch-naming.js";
export { commitFormatGuard } from "./commit-format.js";
export { dependencyAuditGuard } from "./dependency-audit.js";
export { federationGuard } from "./federation.js";
export { fileSizeLimitGuard } from "./file-size-limit.js";
export { hitlReviewGuard } from "./hitl-review.js";
export { hollowArtifactGuard } from "./hollow-artifact.js";
export { noStubReturnGuard } from "./no-stub-return.js";
export { noSwallowedErrorGuard } from "./no-swallowed-error.js";
export { noTriviallyTrueTestGuard } from "./no-trivially-true-test-guard.js";
export { noTypeSafetyBypassGuard } from "./no-type-safety-bypass.js";
export { phaseGateGuard } from "./phase-gate.js";
export { rootPollutionGuard } from "./root-pollution.js";
export { secretDetectionGuard } from "./secret-detection.js";
export { selfProtectionGuard } from "./self-protection.js";
export { ssotPollutionGuard } from "./ssot-pollution.js";
export { ticketIdentityGuard } from "./ticket-identity.js";

import type { Guard } from "../core/types.js";
import { branchNamingGuard } from "./branch-naming.js";
import { commitFormatGuard } from "./commit-format.js";
import { dependencyAuditGuard } from "./dependency-audit.js";
import { federationGuard } from "./federation.js";
import { fileSizeLimitGuard } from "./file-size-limit.js";
import { hitlReviewGuard } from "./hitl-review.js";
import { hollowArtifactGuard } from "./hollow-artifact.js";
import { noStubReturnGuard } from "./no-stub-return.js";
import { noSwallowedErrorGuard } from "./no-swallowed-error.js";
import { noTriviallyTrueTestGuard } from "./no-trivially-true-test-guard.js";
import { noTypeSafetyBypassGuard } from "./no-type-safety-bypass.js";
import { phaseGateGuard } from "./phase-gate.js";
import { rootPollutionGuard } from "./root-pollution.js";
import { secretDetectionGuard } from "./secret-detection.js";
import { selfProtectionGuard } from "./self-protection.js";
import { ssotPollutionGuard } from "./ssot-pollution.js";
import { ticketIdentityGuard } from "./ticket-identity.js";

/** All built-in guards, ready to register with the engine */
export const allBuiltinGuards: Guard[] = [
  hollowArtifactGuard,
  ssotPollutionGuard,
  rootPollutionGuard,
  commitFormatGuard,
  branchNamingGuard,
  phaseGateGuard,
  ticketIdentityGuard,
  hitlReviewGuard,
  federationGuard,
  secretDetectionGuard,
  fileSizeLimitGuard,
  dependencyAuditGuard,
  noTypeSafetyBypassGuard,
  noSwallowedErrorGuard,
  noStubReturnGuard,
  noTriviallyTrueTestGuard,
  selfProtectionGuard,
];
