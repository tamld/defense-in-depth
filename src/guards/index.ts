/**
 * Guards barrel export — all built-in guards in one place.
 */

export { hollowArtifactGuard } from "./hollow-artifact.js";
export { ssotPollutionGuard } from "./ssot-pollution.js";
export { rootPollutionGuard } from "./root-pollution.js";
export { commitFormatGuard } from "./commit-format.js";
export { branchNamingGuard } from "./branch-naming.js";
export { phaseGateGuard } from "./phase-gate.js";
export { ticketIdentityGuard } from "./ticket-identity.js";
export { hitlReviewGuard } from "./hitl-review.js";
export { federationGuard } from "./federation.js";
export { secretDetectionGuard } from "./secret-detection.js";
export { fileSizeLimitGuard } from "./file-size-limit.js";
export { dependencyAuditGuard } from "./dependency-audit.js";
export { noTypeSafetyBypassGuard } from "./no-type-safety-bypass.js";
export { noSwallowedErrorGuard } from "./no-swallowed-error.js";
export { noStubReturnGuard } from "./no-stub-return.js";

import { hollowArtifactGuard } from "./hollow-artifact.js";
import { ssotPollutionGuard } from "./ssot-pollution.js";
import { rootPollutionGuard } from "./root-pollution.js";
import { commitFormatGuard } from "./commit-format.js";
import { branchNamingGuard } from "./branch-naming.js";
import { phaseGateGuard } from "./phase-gate.js";
import { ticketIdentityGuard } from "./ticket-identity.js";
import { hitlReviewGuard } from "./hitl-review.js";
import { federationGuard } from "./federation.js";
import { secretDetectionGuard } from "./secret-detection.js";
import { fileSizeLimitGuard } from "./file-size-limit.js";
import { dependencyAuditGuard } from "./dependency-audit.js";
import { noTypeSafetyBypassGuard } from "./no-type-safety-bypass.js";
import { noSwallowedErrorGuard } from "./no-swallowed-error.js";
import { noStubReturnGuard } from "./no-stub-return.js";
import type { Guard } from "../core/types.js";

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
];
