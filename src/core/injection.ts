/**
 * Lesson Injection — surfaces relevant lessons at the point of guard failure.
 *
 * This module connects guard findings to stored lessons, enabling just-in-time
 * knowledge transfer: when a guard fires, the developer immediately sees
 * lessons from past similar failures across all projects.
 */

import type { Lesson } from "./types.js";
import { readAllLessons } from "./memory.js";

/** Context available when a guard triggers */
export interface InjectionContext {
  /** Guard that triggered (e.g., "hollowArtifact") */
  guardId: string;
  /** File path where the finding occurred */
  filePath: string;
  /** Finding text/match details */
  finding: string;
  /** Optional ticket ID for context */
  ticketId?: string;
  /** Project root for reading lessons */
  projectRoot: string;
}

/** Ranked lesson with injection metadata */
export interface InjectedLesson {
  lesson: Lesson;
  /** Relevance score (0-1) */
  score: number;
  /** Why this lesson matched */
  matchReasons: string[];
  /** Formatted hint for display */
  hint: string;
}

/** Configuration for injection behavior */
export interface InjectionConfig {
  /** Maximum lessons to inject per finding */
  maxLessons: number;
  /** Minimum relevance score threshold */
  minScore: number;
  /** Enable semantic search via DSPy */
  useSemantic: boolean;
  /** DSPy endpoint if semantic enabled */
  dspyEndpoint?: string;
}

/** Default injection configuration */
export const DEFAULT_INJECTION_CONFIG: InjectionConfig = {
  maxLessons: 3,
  minScore: 0.15,
  useSemantic: false,
};

/** Guard ID to lesson pattern mapping for fast pre-filtering */
const GUARD_PATTERN_MAP: Record<string, string[]> = {
  hollowArtifact: ["console-log", "todo", "tbd", "hack", "placeholder", "stub", "mock"],
  ssotPollution: ["config", "drift", "sync", "single-source", "source-of-truth"],
  rootPollution: ["root", "top-level", "workspace-root", "repo-root"],
  commitFormat: ["commit", "conventional", "message-format", "commitlint"],
  branchNaming: ["branch", "naming", "branch-name"],
  phaseGate: ["phase", "gate", "workflow", "process"],
  ticketIdentity: ["ticket", "issue", "ticket-id", "tracking"],
  hitlReview: ["review", "human-in-the-loop", "hitl", "approval"],
  federation: ["federation", "linear", "jira", "sync", "provider"],
  secretDetection: ["secret", "token", "key", "password", "credential"],
  fileSizeLimit: ["file-size", "large-file", "binary", "artifact"],
  dependencyAudit: ["dependency", "vulnerability", "audit", "supply-chain"],
  noTypeSafetyBypass: ["type-safety", "any", "as-any", "ts-ignore", "ts-expect-error"],
  noSwallowedError: ["empty-catch", "swallowed", "catch", "error-handling"],
  noStubReturn: ["stub", "mock-return", "hardcoded-return"],
  noTriviallyTrueTest: ["test", "trivial", "assert-true", "meaningless-test"],
  selfProtection: ["self-protection", "self-guard", "integrity"],
};

/**
 * Get all lessons (with caching per project root).
 */
export async function getLessons(
  projectRoot: string,
  cache: { lessons: Lesson[]; root: string | null },
): Promise<Lesson[]> {
  if (cache.lessons.length > 0 && cache.root === projectRoot) {
    return cache.lessons;
  }
  cache.lessons = await readAllLessons(projectRoot);
  cache.root = projectRoot;
  return cache.lessons;
}

/**
 * Pre-filter lessons by guard-specific patterns.
 * Uses wrongApproachPattern, tags, and category for fast matching.
 */
export function preFilterByGuard(lessons: Lesson[], guardId: string): Lesson[] {
  const patterns = GUARD_PATTERN_MAP[guardId] ?? [];

  // If no specific patterns for this guard, return all lessons
  if (patterns.length === 0) return lessons;

  return lessons.filter((lesson) => {
    // Check wrongApproachPattern
    if (lesson.wrongApproachPattern) {
      const pattern = lesson.wrongApproachPattern.toLowerCase();
      if (patterns.some((p) => pattern.includes(p) || p.includes(pattern))) {
        return true;
      }
    }

    // Check tags
    if (lesson.tags) {
      for (const tag of lesson.tags) {
        const t = tag.toLowerCase();
        if (patterns.some((p) => t.includes(p) || p.includes(t))) {
          return true;
        }
      }
    }

    // Check category
    if (patterns.some((p) => lesson.category.includes(p))) {
      return true;
    }

    // Check searchTerms
    if (lesson.searchTerms) {
      for (const term of lesson.searchTerms) {
        const t = term.toLowerCase();
        if (patterns.some((p) => t.includes(p) || p.includes(t))) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Check if two file paths are related (same dir, same module, etc.)
 */
export function pathsRelated(a: string, b: string): boolean {
  const normalize = (p: string) => p.replace(/\\/g, "/").replace(/^\.\//, "");
  const na = normalize(a);
  const nb = normalize(b);

  // Exact match
  if (na === nb) return true;

  // Same directory
  const dirA = na.substring(0, na.lastIndexOf("/"));
  const dirB = nb.substring(0, nb.lastIndexOf("/"));
  if (dirA && dirA === dirB) return true;

  // One is parent of other
  if (na.startsWith(`${dirB}/`) || nb.startsWith(`${dirA}/`)) return true;

  // Same base name (different extension)
  const baseA = na.substring(na.lastIndexOf("/") + 1).split(".")[0];
  const baseB = nb.substring(nb.lastIndexOf("/") + 1).split(".")[0];
  if (baseA && baseA === baseB) return true;

  return false;
}

/**
 * Infer source project from lesson metadata.
 */
export function inferSourceProject(lesson: Lesson): string {
  // Check relatedFiles for project hints
  if (lesson.relatedFiles) {
    for (const f of lesson.relatedFiles) {
      if (f.includes("tamld-llm-wiki") || f.includes("llm-wiki")) return "tamld-llm-wiki";
      if (f.includes("g8s")) return "g8s";
      if (f.includes("tuneflow")) return "tuneflow";
      if (f.includes("web-login") || f.includes("aaos")) return "web-login-solo";
      if (f.includes("defense-in-depth")) return "defense-in-depth";
    }
  }
  // Check tags
  if (lesson.tags) {
    for (const t of lesson.tags) {
      if (t.includes("wiki")) return "tamld-llm-wiki";
      if (t.includes("g8s")) return "g8s";
      if (t.includes("tuneflow")) return "tuneflow";
      if (t.includes("aaos") || t.includes("web-login")) return "web-login-solo";
    }
  }
  return "";
}

/**
 * Score candidate lessons by relevance to the finding context.
 */
export function scoreCandidates(
  lessons: Lesson[],
  context: InjectionContext,
): Array<{ lesson: Lesson; score: number; reasons: string[] }> {
  return lessons.map((lesson) => {
    const reasons: string[] = [];
    let score = 0;

    // 1. Guard pattern match (strongest signal)
    const patterns = GUARD_PATTERN_MAP[context.guardId] ?? [];
    if (lesson.wrongApproachPattern) {
      const pattern = lesson.wrongApproachPattern.toLowerCase();
      for (const p of patterns) {
        if (pattern.includes(p) || p.includes(pattern)) {
          score += 0.4;
          reasons.push(`wrongApproachPattern: ${pattern}`);
          break;
        }
      }
    }

    // 2. Tag overlap
    if (lesson.tags) {
      for (const tag of lesson.tags) {
        const t = tag.toLowerCase();
        for (const p of patterns) {
          if (t.includes(p) || p.includes(t)) {
            score += 0.2;
            reasons.push(`tag: ${tag}`);
            break;
          }
        }
      }
    }

    // 3. File path similarity (same directory or related module)
    if (lesson.relatedFiles) {
      for (const related of lesson.relatedFiles) {
        if (pathsRelated(context.filePath, related)) {
          score += 0.25;
          reasons.push(`file: ${related}`);
          break;
        }
      }
    }

    // 4. Category relevance
    const categorySignals = {
      hollowArtifact: ["code", "process"],
      ssotPollution: ["tool", "process", "arch"],
      rootPollution: ["arch", "tool"],
      commitFormat: ["process"],
      branchNaming: ["process"],
      phaseGate: ["process", "arch"],
      ticketIdentity: ["process", "tool"],
      hitlReview: ["process"],
      federation: ["tool", "arch"],
      secretDetection: ["code", "arch"],
      fileSizeLimit: ["code", "arch"],
      dependencyAudit: ["tool", "arch"],
      noTypeSafetyBypass: ["code"],
      noSwallowedError: ["code"],
      noStubReturn: ["code"],
      noTriviallyTrueTest: ["code"],
      selfProtection: ["arch"],
    };
    const cats = categorySignals[context.guardId as keyof typeof categorySignals] ?? [];
    if (cats.includes(lesson.category)) {
      score += 0.1;
      reasons.push(`category: ${lesson.category}`);
    }

    // 5. Evidence level (RUNTIME > INFER > HYPO)
    const evidenceWeight = { RUNTIME: 0.15, INFER: 0.1, HYPO: 0.05 };
    score += evidenceWeight[lesson.evidence as keyof typeof evidenceWeight] ?? 0;

    // 6. Confidence
    score += lesson.confidence * 0.1;

    // 7. Recency (newer lessons slightly preferred)
    const ageDays = (Date.now() - new Date(lesson.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 30) score += 0.05;
    else if (ageDays < 90) score += 0.02;

    return { lesson, score: Math.min(score, 1.0), reasons };
  });
}

/**
 * Format a lesson as a concise hint for CLI display.
 */
export function formatHint(lesson: Lesson, reasons: string[], _context: InjectionContext): string {
  const sourceProject = inferSourceProject(lesson);
  const reasonStr = reasons.length > 0 ? ` [${reasons.slice(0, 2).join(", ")}]` : "";

  return (
    `📚 ${lesson.id.slice(0, 8)} ${sourceProject ? `[${sourceProject}] ` : ""}${lesson.title}` +
    `\n   → ${lesson.correctApproach}${reasonStr}`
  );
}

/**
 * Core injection engine — finds and ranks relevant lessons for a guard finding.
 */
export class LessonInjector {
  private config: InjectionConfig;
  private lessonCache: Lesson[] = [];
  private cacheProjectRoot: string | null = null;

  constructor(config: Partial<InjectionConfig> = {}) {
    this.config = { ...DEFAULT_INJECTION_CONFIG, ...config };
  }

  /**
   * Find and rank relevant lessons for a guard finding.
   * Main entry point for injection.
   */
  async inject(context: InjectionContext): Promise<InjectedLesson[]> {
    const lessons = await this.getLessons(context.projectRoot);
    if (lessons.length === 0) return [];

    // Step 1: Fast pre-filter by guard patterns
    const candidates = this.preFilterByGuard(lessons, context.guardId);

    // Step 2: Score candidates by relevance
    const scored = this.scoreCandidates(candidates, context);

    // Step 3: Sort by score descending, take top N
    const top = scored
      .filter((c) => c.score >= this.config.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxLessons);

    // Step 4: Format hints
    return top.map((c) => ({
      lesson: c.lesson,
      score: c.score,
      matchReasons: c.reasons,
      hint: formatHint(c.lesson, c.reasons, context),
    }));
  }

  /**
   * Get all lessons (with caching per project root).
   */
  private async getLessons(projectRoot: string): Promise<Lesson[]> {
    return getLessons(projectRoot, { lessons: this.lessonCache, root: this.cacheProjectRoot });
  }

  /**
   * Pre-filter lessons by guard-specific patterns.
   * Uses wrongApproachPattern, tags, and category for fast matching.
   */
  private preFilterByGuard(lessons: Lesson[], guardId: string): Lesson[] {
    return preFilterByGuard(lessons, guardId);
  }

  /**
   * Score candidate lessons by relevance to the finding context.
   */
  private scoreCandidates(
    lessons: Lesson[],
    context: InjectionContext,
  ): Array<{ lesson: Lesson; score: number; reasons: string[] }> {
    return scoreCandidates(lessons, context);
  }

  }

/**
 * Convenience function for one-shot injection (used by CLI).
 */
export async function injectLessons(
  context: InjectionContext,
  config?: Partial<InjectionConfig>,
): Promise<InjectedLesson[]> {
  const injector = new LessonInjector(config);
  return injector.inject(context);
}

/**
 * Format injected lessons for verify output (compact, single-line per lesson).
 */
export function formatForVerify(injected: InjectedLesson[]): string {
  if (injected.length === 0) return "";

  const lines = ["", "💡 Relevant lessons from past failures:"];
  for (const inj of injected) {
    const shortHint = inj.hint.split("\n")[0];
    lines.push(`  ${shortHint}`);
  }
  return lines.join("\n");
}

/**
 * Format injected lessons for doctor --hints (rich, multi-line).
 */
export function formatForDoctor(injected: InjectedLesson[]): string {
  if (injected.length === 0) return "";

  const lines = ["", "🧠 Injected Lessons (from cross-project memory):"];
  for (const inj of injected) {
    lines.push(`  ${inj.hint}`);
    if (inj.matchReasons.length > 0) {
      lines.push(`     Match: ${inj.matchReasons.join(", ")} (score: ${inj.score.toFixed(2)})`);
    }
  }
  return lines.join("\n");
}
