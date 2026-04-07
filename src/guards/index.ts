/**
 * Guards barrel export — all built-in guards in one place.
 */

export { hollowArtifactGuard } from "./hollow-artifact.js";
export { ssotPollutionGuard } from "./ssot-pollution.js";
export { commitFormatGuard } from "./commit-format.js";
export { branchNamingGuard } from "./branch-naming.js";
export { phaseGateGuard } from "./phase-gate.js";

import { hollowArtifactGuard } from "./hollow-artifact.js";
import { ssotPollutionGuard } from "./ssot-pollution.js";
import { commitFormatGuard } from "./commit-format.js";
import { branchNamingGuard } from "./branch-naming.js";
import { phaseGateGuard } from "./phase-gate.js";
import type { Guard } from "../core/types.js";

/** All built-in guards, ready to register with the engine */
export const allBuiltinGuards: Guard[] = [
  hollowArtifactGuard,
  ssotPollutionGuard,
  commitFormatGuard,
  branchNamingGuard,
  phaseGateGuard,
];
