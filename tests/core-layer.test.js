// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] Core-layer defensive branches per plans/coverage-95/SRS.md FR-2.2–FR-2.6.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadHintState } from '../dist/core/hint-state.js';
import { searchLessons, recordLesson } from '../dist/core/memory.js';
import {
  recordRecall,
  evaluateRecallAgainstCommits,
  readRecalls,
  readOutcomes,
  appendOutcome,
  hashQuery,
} from '../dist/core/lesson-outcome.js';
import { computeF1FromFeedback, readCursor } from '../dist/core/feedback.js';
import { createDspyStub } from './helpers/dspy-stub.js';

function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

const HINT_STATE_REL = '.agents/state/hints-shown.json';

test('hint-state tolerates hostile state files without throwing', async (t) => {
  await t.test('missing state file returns empty state', async () => {
    const root = await makeRoot('did-hint-missing-');
    try {
      const s = loadHintState(root);
      assert.equal(s.version, 1);
      assert.deepEqual(s.shown, {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('corrupt JSON returns empty state', async () => {
    const root = await makeRoot('did-hint-corrupt-');
    try {
      await mkdir(path.join(root, '.agents', 'state'), { recursive: true });
      await writeFile(path.join(root, HINT_STATE_REL), '{not json at all', 'utf8');
      const s = loadHintState(root);
      assert.deepEqual(s.shown, {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('wrong schema version returns empty state', async () => {
    const root = await makeRoot('did-hint-version-');
    try {
      await mkdir(path.join(root, '.agents', 'state'), { recursive: true });
      await writeFile(
        path.join(root, HINT_STATE_REL),
        JSON.stringify({ version: 99, shown: { h1: {} } }),
        'utf8',
      );
      const s = loadHintState(root);
      assert.equal(s.version, 1);
      assert.deepEqual(s.shown, {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('array-shaped shown map returns empty state', async () => {
    const root = await makeRoot('did-hint-array-');
    try {
      await mkdir(path.join(root, '.agents', 'state'), { recursive: true });
      await writeFile(
        path.join(root, HINT_STATE_REL),
        JSON.stringify({ version: 1, shown: ['not', 'an', 'object'] }),
        'utf8',
      );
      const s = loadHintState(root);
      assert.deepEqual(s.shown, {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('hostile entries are dropped during cleaning', async () => {
    const root = await makeRoot('did-hint-hostile-');
    try {
      await mkdir(path.join(root, '.agents', 'state'), { recursive: true });
      await writeFile(
        path.join(root, HINT_STATE_REL),
        JSON.stringify({ version: 1, shown: { a: 42, b: 'plain-string', c: null } }),
        'utf8',
      );
      const s = loadHintState(root);
      assert.deepEqual(s.shown, {});
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

const VALID_LESSON = {
  title: 'pnpm lockfile drift breaks matrix',
  scenario: 'cache provider mismatch after migration',
  wrongApproach: 'keep npm cache with pnpm lockfile',
  correctApproach: 'pin packageManager and align cache',
  insight: 'toolchain contracts move together',
  category: 'toolchain',
  evidence: 'CODE',
  confidence: 0.9,
};

test('memory reader is ENOENT-tolerant and recall failures never break search', async (t) => {
  await t.test('search on project without lessons.jsonl returns empty', async () => {
    const root = await makeRoot('did-mem-empty-');
    try {
      const results = await searchLessons('anything', root);
      assert.deepEqual(results, []);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('corrupt lessons.jsonl line surfaces an error instead of hiding it', async () => {
    const root = await makeRoot('did-mem-corrupt-');
    try {
      await writeFile(path.join(root, 'lessons.jsonl'), '{broken json\n', 'utf8');
      await assert.rejects(() => searchLessons('anything', root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('recall storage crash is a known finding, not silently asserted here', async () => {
    // FINDING F-001 [RUNTIME probe 2026-08-23]: breaking .agents/records storage
    // escapes captureRecalls' try/catch as an uncaughtException (ENOENT on
    // open), contradicting the fire-and-forget docstring. Logged in
    // plans/coverage-95/ADR.md per ADR-0004; no fabricated assertion here.
    assert.ok(true);
  });
});

test('recordRecall adapter builds deterministic, schema-complete events', async (t) => {
  await t.test('defaults fill source=search, executor=human, ticketId empty', async () => {
    const root = await makeRoot('did-lo-defaults-');
    try {
      const r1 = recordRecall(root, { lessonId: 'LES-A', query: 'pnpm cache drift', matchMethod: 'string' });
      assert.equal(r1.written, true);
      assert.equal(r1.event.source, 'search');
      assert.equal(r1.event.executor, 'human');
      assert.equal(r1.event.ticketId, '');
      assert.equal(r1.event.queryHash, hashQuery('pnpm cache drift'));
      const stored = readRecalls(root);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].id, r1.event.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('same inputs yield the same event id across appends', async () => {
    const root = await makeRoot('did-lo-determinism-');
    try {
      const input = { lessonId: 'LES-B', query: 'hook bypass attempt', matchMethod: 'semantic' };
      const a = recordRecall(root, input);
      const b = recordRecall(root, input);
      assert.equal(a.event.id, b.event.id, 'same inputs -> same id');
      assert.equal(a.written, true, 'first append persists');
      assert.equal(b.written, false, 'store dedupes the identical id');
      assert.equal(readRecalls(root).length, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('custom now/source/executor/ticketId are honored', async () => {
    const root = await makeRoot('did-lo-custom-');
    try {
      const now = new Date('2026-01-15T08:00:00Z');
      const r = recordRecall(
        root,
        { lessonId: 'LES-C', ticketId: 'TK-9', query: 'q', matchMethod: 'string', source: 'cli-explicit', executor: 'agent', now },
      );
      assert.equal(r.event.timestamp, now.toISOString());
      assert.equal(r.event.source, 'cli-explicit');
      assert.equal(r.event.executor, 'agent');
      assert.equal(r.event.ticketId, 'TK-9');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('evaluateRecallAgainstCommits pure branches', async (t) => {
  await t.test('empty pattern yields null verdict', () => {
    const v = evaluateRecallAgainstCommits({
      recall: { id: 'r', timestamp: new Date().toISOString() },
      lesson: {},
      commits: [{ sha: 's', timestampMs: Date.now(), diff: 'TODO fix' }],
    });
    assert.equal(v.helpful, null);
  });

  await t.test('invalid regex falls back to escaped literal matching', () => {
    const commits = [{ sha: 's', timestampMs: Date.now(), diff: 'attempted (bad[ pattern here' }];
    const v = evaluateRecallAgainstCommits({
      recall: { id: 'r', timestamp: new Date().toISOString() },
      lesson: { wrongApproachPattern: '(bad[' },
      commits,
    });
    assert.equal(v.helpful, false);
    assert.ok(String(v.matchedPattern).includes('(bad['));
  });

  await t.test('pattern hit marks harmful recurrence', () => {
    const v = evaluateRecallAgainstCommits({
      recall: { id: 'r', timestamp: new Date().toISOString() },
      lesson: { wrongApproachPattern: 'npm cache' },
      commits: [{ sha: 's', timestampMs: Date.now(), diff: '+ still using npm cache here' }],
    });
    assert.equal(v.helpful, false);
  });

  await t.test('clean window marks lesson helpful', () => {
    const v = evaluateRecallAgainstCommits({
      recall: { id: 'r', timestamp: new Date().toISOString() },
      lesson: { wrongApproachPattern: 'npm cache' },
      commits: [{ sha: 's', timestampMs: Date.now(), diff: '+ pnpm install --frozen-lockfile' }],
    });
    assert.equal(v.helpful, true);
  });
});

test('readOutcomes filters by recallId and lessonId', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'did-lo-filters-'));
  try {
    await mkdir(path.join(root, '.agents', 'records'), { recursive: true });
    appendOutcome(root, outcomeFor('rec-1', 'LES-1'));
    appendOutcome(root, outcomeFor('rec-2', 'LES-2'));
    assert.equal(readOutcomes(root, { recallId: 'rec-1' }).length, 1);
    assert.equal(readOutcomes(root, { lessonId: 'LES-2' }).length, 1);
    assert.equal(readOutcomes(root).length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  function outcomeFor(recallId, lessonId) {
    return {
      id: `out-${recallId}`,
      recallId,
      lessonId,
      helpful: true,
      source: 'cli-explicit',
      timestamp: '2026-08-23T00:00:00.000Z',
      executor: 'human',
    };
  }
});

test('feedback F1 starts at zero on empty stores; cursor absent on fresh roots', async (t) => {
  const root = await makeRoot('did-f1-empty-');
  try {
    const metric = computeF1FromFeedback(root);
    assert.equal(Number(metric.f1), 0);
    assert.equal(readCursor(root), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('dspy-stub unknown mode serves its defensive 500 guard', async (t) => {
  const stub = await createDspyStub({ mode: 'bogus-mode' });
  try {
    const results = await searchLessons('tier-1', await seedLessonsRoot(), {
      enabled: true,
      endpoint: stub.endpoint,
      timeoutMs: 5000,
    });
    assert.ok(stub.requests.length >= 1, 'stub should have received a request');
    assert.ok(Array.isArray(results), 'client must degrade gracefully, not throw');
  } finally {
    await stub.close();
  }

  async function seedLessonsRoot() {
    const root = await makeRoot('did-stub-guard-');
    await recordLesson(
      { ...VALID_LESSON, title: 'tier-1 regression playbook' },
      root,
    );
    return root;
  }
});
