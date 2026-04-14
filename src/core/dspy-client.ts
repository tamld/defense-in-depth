/**
 * Shared DSPy HTTP Client — Zero-Infrastructure Adapter
 *
 * Extracted from hollow-artifact.ts (v0.5) to serve as the
 * universal DSPy integration point across all DiD layers:
 *   - Guard pipeline (hollow-artifact semantic evaluation)
 *   - Lesson quality gate (reject generic lessons)
 *   - Semantic lesson search (replace String.includes)
 *   - Meta memory recall evaluation (v0.6+)
 *
 * Architecture contract:
 *   1. OPT-IN — never called unless explicitly enabled
 *   2. TIMEOUT-GUARDED — AbortController with configurable ms
 *   3. GRACEFUL DEGRADATION — failure = null, never crashes pipeline
 *   4. WARN-NOT-BLOCK — DSPy findings never have veto power
 *
 * Attribution: Built to integrate with Stanford NLP DSPy framework (MIT License)
 *   https://github.com/stanfordnlp/dspy
 *
 * @module core/dspy-client
 */

import type { EvaluationScore } from "./types.js";

/** Response schema from a DSPy evaluation HTTP endpoint */
export interface DSPyEvalResponse {
  score: number;
  feedback?: string;
  dimensions?: Record<string, number>;
}

/** Payload types for different DSPy evaluation modes */
export type DSPyEvalType = "artifact" | "lesson" | "search" | "recall";

/** Generic evaluation request payload */
export interface DSPyEvalRequest {
  /** Evaluation type — tells the service which DSPy module to invoke */
  type: DSPyEvalType;
  /** Identifier for the item being evaluated */
  id: string;
  /** Primary content to evaluate */
  content: string;
  /** Optional context (e.g., search query for relevance scoring) */
  context?: string;
  /** Optional batch of items (e.g., lessons to rank for search) */
  candidates?: Array<{ id: string; content: string }>;
}

/** Default timeout for DSPy HTTP calls */
const DEFAULT_DSPY_TIMEOUT_MS = 5000;

/** Default DSPy endpoint */
const DEFAULT_DSPY_ENDPOINT = "http://localhost:8080/evaluate";

/**
 * Call DSPy HTTP endpoint for semantic evaluation.
 *
 * This is the single shared function used by ALL DiD layers that need
 * semantic intelligence. It follows the exact same graceful degradation
 * pattern established in hollow-artifact.ts v0.5.
 *
 * @returns EvaluationScore or null if the call fails (graceful degradation)
 */
export async function callDspy(
  request: DSPyEvalRequest,
  endpoint: string = DEFAULT_DSPY_ENDPOINT,
  timeoutMs: number = DEFAULT_DSPY_TIMEOUT_MS,
): Promise<EvaluationScore | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`⚠ DSPy service returned ${response.status} for ${request.type}:${request.id}`);
      return null;
    }

    const data = await response.json() as Partial<DSPyEvalResponse>;

    return {
      artifactPath: request.id,
      score: typeof data.score === "number" ? data.score : 0,
      maxScore: 1.0,
      evaluator: `dspy-${request.type}`,
      feedback: data.feedback,
      dimensions: data.dimensions,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠ DSPy evaluation failed for ${request.type}:${request.id}: ${message}`);
    return null;
  }
}

/**
 * Batch evaluate multiple items via DSPy search/ranking.
 *
 * Sends a query + candidate list to the DSPy service for semantic ranking.
 * Used by semantic lesson search to rank lessons by relevance.
 *
 * @returns Array of { id, score } sorted by descending score, or null on failure
 */
export async function callDspyRank(
  query: string,
  candidates: Array<{ id: string; content: string }>,
  endpoint: string = DEFAULT_DSPY_ENDPOINT,
  timeoutMs: number = DEFAULT_DSPY_TIMEOUT_MS,
): Promise<Array<{ id: string; score: number; feedback?: string }> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "search" as DSPyEvalType,
        id: "search-query",
        content: query,
        candidates,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`⚠ DSPy rank service returned ${response.status}`);
      return null;
    }

    const data = await response.json() as { results?: Array<{ id: string; score: number; feedback?: string }> };
    return data.results ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠ DSPy rank failed: ${message}`);
    return null;
  }
}

export { DEFAULT_DSPY_ENDPOINT, DEFAULT_DSPY_TIMEOUT_MS };
