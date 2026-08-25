// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] scanOutcomes window/DSPy-degraded branches per plans/coverage-95/SRS.md FR-2.1 residual.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  scanOutcomes,
  appendRecall,
  appendOutcome,
} from '../dist/core/lesson-outcome.js';
import { createDspyStub, getClosedPort } from './helpers/dspy-stub.js';

const NOW = new Date('2026-08-24T12:00:00Z');
const RECENT_TS = '2026-08-24T10:00:00Z';
const EXPIRED_TS = '2026-07-01T00:00:00Z';
const OUTCOMES_REL = '.agents/records/lesson-outcomes.jsonl';
const PATTERN_LESSON = { id: 'LES-PAT', wrongApproachPattern: 'npm cache' };
const FUZZY_LESSON = { id: 'LES-FUZZY', wrongApproach: 'kept npm cache configured in CI' };

function git(root, args, env) {
  return execFileSync('git', args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

async function makeScanRoot(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test Runner']);
  await writeFile(path.join(root, 'notes.md'), 'avoid npm cache drift\n', 'utf8');
  git(root, ['add', '.']);
  const seedDate = '2026-08-24T11:00:00Z';
  git(
    root,
    ['commit', '-q', '--no-gpg-sign', '-m', 'chore: seed scan repo'],
    { GIT_AUTHOR_DATE: seedDate, GIT_COMMITTER_DATE: seedDate },
  );
  return root;
}

function recall(id, lessonId, timestamp) {
  return {
    id,
    lessonId,
    ticketId: '',
    queryHash: `hash-${id}`,
    matchMethod: 'string',
    source: 'search',
    executor: 'human',
    timestamp,
  };
}

test('scanOutcomes skips malformed and expired recalls', async (t) => {
  await t.test('recall with unparseable timestamp is counted but not proposed', async () => {
    const root = await makeScanRoot('did-scan-nan-');
    try {
      await appendRecall(root, recall('r-nan', 'LES-PAT', 'not-a-timestamp'));
      const res = await scanOutcomes(root, [PATTERN_LESSON], { now: NOW });
      assert.equal(res.scanned, 1);
      assert.equal(res.proposed.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('lookback-expired recall skipped; recent pattern recall proposed', async () => {
    const root = await makeScanRoot('did-scan-expiry-');
    try {
      await appendRecall(root, recall('r-old', 'LES-PAT', EXPIRED_TS));
      await appendRecall(root, recall('r-new', 'LES-PAT', RECENT_TS));
      const res = await scanOutcomes(root, [PATTERN_LESSON], { now: NOW });
      assert.equal(res.scanned, 2);
      assert.equal(res.proposed.length, 1);
      assert.equal(res.proposed[0].helpful, false);
      assert.ok(String(res.proposed[0].matchedPattern).includes('npm cache'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('scanOutcomes dedupes already-evaluated recalls and honors dry-run', async (t) => {
  await t.test('recall with existing outcome is not re-proposed', async () => {
    const root = await makeScanRoot('did-scan-dedupe-');
    try {
      const ev = recall('r-dup', 'LES-PAT', RECENT_TS);
      await appendRecall(root, ev);
      const first = await scanOutcomes(root, [PATTERN_LESSON], { now: NOW });
      assert.equal(first.written, 1);
      const second = await scanOutcomes(root, [PATTERN_LESSON], { now: NOW });
      assert.equal(second.proposed.length, 0);
      assert.equal(second.scanned, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('dry run proposes without touching disk', async () => {
    const root = await makeScanRoot('did-scan-dry-');
    try {
      await appendRecall(root, recall('r-dry', 'LES-PAT', RECENT_TS));
      const res = await scanOutcomes(root, [PATTERN_LESSON], { now: NOW, dryRun: true });
      assert.equal(res.dryRun === undefined || res.dryRun === true, true);
      assert.equal(res.proposed.length, 1);
      assert.equal(res.written, 0);
      assert.equal(res.skippedDuplicates, 0);
      let onDisk = '';
      try {
        onDisk = await readFile(path.join(root, OUTCOMES_REL), 'utf8');
      } catch {
        onDisk = '';
      }
      assert.equal(onDisk, '', 'dry run must not write outcomes file');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('scanOutcomes DSPy fuzzy-match branches', async (t) => {
  await t.test('unreachable endpoint degrades once with single warning', async () => {
    const root = await makeScanRoot('did-scan-degraded-');
    const origErrWrite = process.stderr.write.bind(process.stderr);
    const chunks = [];
    try {
      await appendRecall(root, recall('r-fz1', 'LES-FUZZY', RECENT_TS));
      await appendRecall(root, recall('r-fz2', 'LES-FUZZY', RECENT_TS));
      const closed = await getClosedPort();
      process.stderr.write = (chunk) => {
        chunks.push(String(chunk));
        return true;
      };
      const res = await scanOutcomes(root, [FUZZY_LESSON], {
        now: NOW,
        dspy: { enabled: true, endpoint: closed.endpoint, timeoutMs: 400 },
      });
      process.stderr.write = origErrWrite;
      assert.equal(res.dspyDegraded, true);
      assert.equal(res.proposed.length, 2);
      for (const p of res.proposed) {
        assert.equal(p.helpful, null);
        assert.equal(p.source, 'scanner-no-match');
      }
      const warns = chunks.join('').split('[scan-outcomes] DSPy fuzzy match unavailable').length - 1;
      assert.equal(warns, 1, 'warning must fire exactly once even with two recalls');
    } finally {
      process.stderr.write = origErrWrite;
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('high similarity score marks harmful recurrence as dspy verdict', async () => {
    const root = await makeScanRoot('did-scan-hot-');
    const stub = await createDspyStub({ mode: 'score', score: 0.9 });
    try {
      await appendRecall(root, recall('r-hot', 'LES-FUZZY', RECENT_TS));
      const res = await scanOutcomes(root, [FUZZY_LESSON], {
        now: NOW,
        dspy: { enabled: true, endpoint: stub.endpoint, timeoutMs: 4000 },
      });
      assert.equal(res.proposed.length, 1);
      assert.equal(res.proposed[0].helpful, false);
      assert.equal(res.proposed[0].matchedPattern, 'dspy:0.90');
      assert.ok(stub.requests.length >= 1);
    } finally {
      await stub.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('low similarity score marks the lesson helpful', async () => {
    const root = await makeScanRoot('did-scan-clean-');
    const stub = await createDspyStub({ mode: 'score', score: 0.3 });
    try {
      await appendRecall(root, recall('r-clean', 'LES-FUZZY', RECENT_TS));
      const res = await scanOutcomes(root, [FUZZY_LESSON], {
        now: NOW,
        dspy: { enabled: true, endpoint: stub.endpoint, timeoutMs: 4000 },
      });
      assert.equal(res.proposed.length, 1);
      assert.equal(res.proposed[0].helpful, true);
      assert.equal(res.proposed[0].source, 'scanner-no-match');
    } finally {
      await stub.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
