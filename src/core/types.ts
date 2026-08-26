/**
 * Core type definitions for defense-in-depth.
 *
 * Public type surface barrel. The concrete declarations live in
 * `src/types/*.ts` (guard / engine / config / metrics / hints groups);
 * this file re-exports them so every import path — including the npm
 * `defense-in-depth/types` subpath and `src/core/types.js` consumers —
 * stays byte-for-byte compatible.
 */

export * from "./types/guard.js";
export * from "./types/engine.js";
export * from "./types/config.js";
export * from "./types/metrics.js";
export * from "./types/hints.js";
