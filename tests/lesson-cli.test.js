// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] CLI handler branch coverage for src/cli/lesson.ts per plans/coverage-95/SRS.md FR-1.1.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleLessonCommand } from '../dist/cli/lesson/index.js';

const EXIT_SENTINEL = '__PROCESS_EXIT__';
const RECALLS_REL = path.join('.agents', 'records', 'lesson-recalls.jsonl');
const OUTCOMES_REL = path.join('.agents', 'records', 'lesson-outcomes.jsonl');

const VALID_PAYLOAD = {
  title: 'Lockfile drift breaks CI matrix',
  scenario: 'pnpm migration left npm cache configured in CI',
  wrongApproach: 'keep npm cache while lockfile is pnpm-lock.yaml',
  correctApproach: 'pin packageManager and align cache provider',
  insight: 'toolchain contracts must move together or CI exposes the gap',
  category: 'toolchain',
  evidence: 'CODE',
  confidence: 0.9,
};

async function makeRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'did-lesson-cli-'));
}

async function runLesson(root, args) {
  const logs = [];
  const errors = [];
  const stdoutChunks = [];
  const stderrChunks = [];
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;
  const origOutWrite = process.stdout.write.bind(process.stdout);
  const origErrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  // scan-outcomes / recalls print via process.stdout.write, not console
  process.stdout.write = (chunk) => { stdoutChunks.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { stderrChunks.push(String(chunk)); return true; };
  process.exit = ((code) => {
    throw `${EXIT_SENTINEL}:${code}`;
  });
  let exitCode = null;
  try {
    await handleLessonCommand(root, args);
  } catch (err) {
    if (typeof err === 'string' && err.startsWith(EXIT_SENTINEL)) {
      exitCode = Number(err.slice(EXIT_SENTINEL.length + 1));
    } else {
      process.exit = origExit;
      console.log = origLog;
      console.error = origErr;
      process.stdout.write = origOutWrite;
      process.stderr.write = origErrWrite;
      throw err;
    }
  }
  process.exit = origExit;
  console.log = origLog;
  console.error = origErr;
  process.stdout.write = origOutWrite;
  process.stderr.write = origErrWrite;
  return { exitCode, logs, errors, stdout: stdoutChunks.join(''), stderrRaw: stderrChunks.join('') };
}

function assertExitOne(result, label) {
  assert.equal(result.exitCode, 1, `${label} should exit 1`);
}

async function recordSeed(root) {
  const res = await runLesson(root, ['record', '--data', JSON.stringify(VALID_PAYLOAD)]);
  assert.equal(res.exitCode, null, 'valid record should not exit');
  const joined = res.logs.join('\n');
  const match = joined.match(/ID:\s*([^\s\]]+)/);
  assert.ok(match, `record should log lesson ID, got: ${joined}`);
  return match[1];
}

async function seedRecall(root, lessonId, recallId = 'rec-1') {
  const dir = path.dirname(path.join(root, RECALLS_REL));
  await mkdir(dir, { recursive: true });
  const recall = {
    id: recallId,
    lessonId,
    ticketId: '',
    queryHash: 'seed-hash',
    matchMethod: 'string',
    source: 'search',
    executor: 'human',
    timestamp: '2026-08-23T00:00:00.000Z',
  };
  await writeFile(path.join(root, RECALLS_REL), `${JSON.stringify(recall)}\n`, 'utf8');
}

test('lesson CLI handler branches', async (t) => {
  await t.test('unknown subcommand exits 1 with usage', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['bogus-subcommand']);
      assertExitOne(res, 'unknown subcommand');
      assert.ok(res.errors.join('\n').length > 0, 'usage text expected on stderr');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record without --data or --file exits 1', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['record']);
      assertExitOne(res, 'missing payload source');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record with invalid JSON payload exits 1', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['record', '--data', '{not json']);
      assertExitOne(res, 'invalid JSON');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record missing mandatory fields exits 1 and lists them', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['record', '--data', JSON.stringify({ title: 'only-title' })]);
      assertExitOne(res, 'missing fields');
      assert.ok(res.errors.join('\n').includes('wrongApproach'), 'should name a missing field');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record confidence outside [0,1] exits 1', async () => {
    const root = await makeRoot();
    try {
      const bad = { ...VALID_PAYLOAD, confidence: 1.5 };
      const res = await runLesson(root, ['record', '--data', JSON.stringify(bad)]);
      assertExitOne(res, 'confidence range');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record invalid evidence level exits 1', async () => {
    const root = await makeRoot();
    try {
      const bad = { ...VALID_PAYLOAD, evidence: 'GOSSIP' };
      const res = await runLesson(root, ['record', '--data', JSON.stringify(bad)]);
      assertExitOne(res, 'evidence level');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record valid payload persists lessons.jsonl with fields', async () => {
    const root = await makeRoot();
    try {
      await recordSeed(root);
      const raw = await readFile(path.join(root, 'lessons.jsonl'), 'utf8');
      const stored = JSON.parse(raw.trim().split('\n')[0]);
      assert.equal(stored.title, VALID_PAYLOAD.title);
      assert.equal(stored.category, VALID_PAYLOAD.category);
      assert.equal(stored.wrongApproach, VALID_PAYLOAD.wrongApproach);
      assert.equal(stored.confidence, VALID_PAYLOAD.confidence);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('search without query exits 1', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['search']);
      assertExitOne(res, 'empty query');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('search with no match reports none found', async () => {
    const root = await makeRoot();
    try {
      await recordSeed(root);
      const res = await runLesson(root, ['search', 'zzz-unfindable-term']);
      assert.equal(res.exitCode, null, 'empty result is not an error');
      assert.ok(res.logs.join('\n').toLowerCase().includes('no lessons found'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('search hit prints lesson identity block', async () => {
    const root = await makeRoot();
    try {
      await recordSeed(root);
      const res = await runLesson(root, ['search', 'Lockfile']);
      assert.equal(res.exitCode, null);
      const joined = res.logs.join('\n');
      assert.ok(joined.includes('[ID]'), 'identity line expected');
      assert.ok(joined.includes('Lockfile drift'), 'title expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('outcome requires exactly one verdict flag', async () => {
    const root = await makeRoot();
    try {
      const neither = await runLesson(root, ['outcome', 'LES-1']);
      assertExitOne(neither, 'no verdict flag');
      const both = await runLesson(root, ['outcome', 'LES-1', '--helpful', '--not-helpful']);
      assertExitOne(both, 'conflicting verdict flags');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('outcome without prior recall event exits 1', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['outcome', 'LES-MISSING', '--helpful']);
      assertExitOne(res, 'no recall chain');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('outcome happy path writes outcome once and is idempotent on replay', async () => {
    const root = await makeRoot();
    try {
      const lessonId = await recordSeed(root);
      await seedRecall(root, lessonId);
      const first = await runLesson(root, ['outcome', lessonId, '--helpful']);
      assert.equal(first.exitCode, null, 'first outcome should succeed');
      const firstSignal = `${first.stdout}\n${first.logs.join('\n')}`.toUpperCase();
      assert.ok(firstSignal.includes('HELPFUL'), 'success line expected on stdout');
      assert.ok(firstSignal.includes('RECORDED'), 'recorded confirmation expected');
      const outcomesPath = path.join(root, OUTCOMES_REL);
      const afterFirst = (await readFile(outcomesPath, 'utf8')).trim().split('\n').length;

      const replay = await runLesson(root, ['outcome', lessonId, '--helpful']);
      assert.equal(replay.exitCode, null, 'replay should not crash');
      const replaySignal = `${replay.stderrRaw}\n${replay.errors.join('\n')}`;
      assert.ok(replaySignal.includes('already recorded'), 'idempotent skip explanation expected');
      const afterReplay = (await readFile(outcomesPath, 'utf8')).trim().split('\n').length;
      assert.equal(afterReplay, afterFirst, 'duplicate outcome must not append');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('scan-outcomes tolerates empty project and reports counts', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['scan-outcomes']);
      assert.equal(res.exitCode, null, 'empty project scan should not crash');
      assert.match(`${res.stdout}\n${res.logs.join('\n')}`, /scanned/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('recalls rejects unknown subcommand and lists seeded events', async () => {
    const root = await makeRoot();
    try {
      const badSub = await runLesson(root, ['recalls', 'purge']);
      assertExitOne(badSub, 'recalls subcommand guard');

      const empty = await runLesson(root, ['recalls', 'list']);
      assert.equal(empty.exitCode, null);
      assert.ok(`${empty.stdout}\n${empty.logs.join('\n')}`.toLowerCase().includes('no recall events match'));

      const lessonId = await recordSeed(root);
      await seedRecall(root, lessonId);
      const listed = await runLesson(root, ['recalls', 'list']);
      assert.equal(listed.exitCode, null);
      const joined = `${listed.stdout}\n${listed.logs.join('\n')}`;
      assert.ok(joined.includes('string'), 'matchMethod column expected');
      assert.ok(joined.includes(lessonId), 'lesson reference expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('lesson tails: ticket attribution, ghost recall, list filters', async (t) => {
  await t.test('search --ticket attributes recorded recall to the ticket', async () => {
    const root = await makeRoot();
    try {
      await recordSeed(root);
      const res = await runLesson(root, ['search', 'Lockfile', '--ticket', 'TK-9']);
      assert.equal(res.exitCode, null);
      const content = await readFile(path.join(root, RECALLS_REL), 'utf8');
      assert.ok(content.includes('"TK-9"'), 'recall must carry ticket attribution, got: ' + content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('outcome with unknown --recall id exits 1', async () => {
    const root = await makeRoot();
    try {
      const lessonId = await recordSeed(root);
      await seedRecall(root, lessonId, 'rec-real');
      const res = await runLesson(root, ['outcome', lessonId, '--helpful', '--recall', 'rec-ghost']);
      assertExitOne(res, 'ghost recall id must exit 1');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('recalls list honors --since and --limit filters', async () => {
    const root = await makeRoot();
    try {
      await mkdir(path.join(root, '.agents', 'records'), { recursive: true });
      const mkLine = (id, ts) => JSON.stringify({ id, lessonId: 'LES-F', ticketId: '', queryHash: 'h-' + id, matchMethod: 'string', source: 'search', executor: 'human', timestamp: ts });
      await writeFile(
        path.join(root, RECALLS_REL),
        mkLine('rec-old', '2026-01-01T00:00:00.000Z') + '\n' + mkLine('rec-new', '2026-06-01T00:00:00.000Z') + '\n',
        'utf8',
      );
      const future = await runLesson(root, ['recalls', 'list', '--since', '2099-01-01T00:00:00Z']);
      assert.equal(future.exitCode, null);
      const futureOut = [future.stdout, future.logs.join('\n')].join('\n').toLowerCase();
      assert.ok(futureOut.includes('no recall events match'));

      const limited = await runLesson(root, ['recalls', 'list', '--limit', '1']);
      assert.equal(limited.exitCode, null);
      const out = [limited.stdout, limited.logs.join('\n')].join('\n');
      assert.equal((out.match(/lesson=/g) || []).length, 1, 'limit 1 must yield a single row');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] Residual branch coverage for dist/cli/lesson.js uncovered ranges
// 39-48 (--file), 99-105 + 107-109 (quality gate), 144-146 (semantic
// relevance line), 153-157 (outcome lessonId guard), 240-245 (scan read
// failure). DSPy paths bind the default endpoint localhost:8080 because the
// CLI hardcodes { enabled: true } without an endpoint override.
import { createServer } from 'node:http';

async function withDspyServer(responseBody, fn) {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseBody));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(8080, resolve);
  });
  try {
    return await fn();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('lesson residuals: --file ingestion, outcome guard, scan read failure', async (t) => {
  await t.test('record --file ingests payload from disk and persists', async () => {
    const root = await makeRoot();
    try {
      const payloadPath = path.join(root, 'payload.json');
      await writeFile(payloadPath, JSON.stringify(VALID_PAYLOAD), 'utf8');
      const res = await runLesson(root, ['record', '--file', payloadPath]);
      assert.equal(res.exitCode, null, '--file record should succeed');
      const raw = await readFile(path.join(root, 'lessons.jsonl'), 'utf8');
      assert.equal(JSON.parse(raw.trim().split('\n')[0]).title, VALID_PAYLOAD.title);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('record --file unreadable path exits 1 with read error', async () => {
    const root = await makeRoot();
    try {
      const res = await runLesson(root, ['record', '--file', path.join(root, 'ghost.json')]);
      assertExitOne(res, 'missing payload file must exit 1');
      assert.ok(res.errors.join('\n').includes('Failed to read payload file'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('outcome without lessonId or flag-like lessonId exits 1', async () => {
    const root = await makeRoot();
    try {
      const none = await runLesson(root, ['outcome']);
      assertExitOne(none, 'missing lessonId must exit 1');
      const flagLike = await runLesson(root, ['outcome', '--helpful']);
      assertExitOne(flagLike, 'flag-like lessonId must exit 1');
      assert.ok(flagLike.errors.join('\n').includes('requires a <lessonId>'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('scan-outcomes exits 1 when lessons.jsonl is corrupt', async () => {
    const root = await makeRoot();
    try {
      await writeFile(path.join(root, 'lessons.jsonl'), '{not-valid-json\n', 'utf8');
      const res = await runLesson(root, ['scan-outcomes']);

      assertExitOne(res, 'corrupt lessons store must exit 1');
      assert.ok(`${res.stderrRaw}\n${res.errors.join('\n')}`.includes('failed to read lessons.jsonl'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('scan-outcomes prints UNKNOWN proposals for unjudged recalls', async () => {
    const root = await makeRoot();
    try {
      await writeFile(
        path.join(root, 'lessons.jsonl'),
        `${JSON.stringify({ id: 'les-x', title: 't', wrongApproach: 'did bad' })}\n`,
        'utf8'
      );
      await seedRecall(root, 'les-x');
      const res = await runLesson(root, ['scan-outcomes']);

      assert.equal(res.exitCode, null, 'scan should not exit');
      const out = `${res.stdout}\n${res.logs.join('\n')}`;
      assert.ok(out.includes('UNKNOWN'), 'unjudged recall must print UNKNOWN verdict');
      assert.ok(out.includes('lesson=les-x'), 'lesson id expected in proposal line');
      assert.ok(out.includes('recall=rec-1'), 'recall id expected in proposal line');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('lesson quality-gate: rejection and scored success via DSPy endpoint', async (t) => {
  await t.test('--quality-gate rejects low-scoring lesson with feedback and exits 1', async () => {
    const root = await makeRoot();
    try {
      await withDspyServer({ score: 0.2, feedback: 'too vague to recall' }, async () => {
        const res = await runLesson(root, ['record', '--quality-gate', '--data', JSON.stringify(VALID_PAYLOAD)]);
        assertExitOne(res, 'rejected lesson must exit 1');
        const joined = `${res.stderrRaw}\n${res.errors.join('\n')}`;
        assert.ok(joined.includes('REJECTED by quality gate'));
        assert.ok(joined.includes('0.20'), 'score expected in rejection message');
        assert.ok(joined.includes('too vague to recall'), 'feedback expected');
      });
      const raw = await readFile(path.join(root, 'lessons.jsonl'), 'utf8').catch(() => '');
      assert.equal(raw, '', 'rejected lesson must NOT be persisted');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('--quality-gate success prints quality score', async () => {
    const root = await makeRoot();
    try {
      await withDspyServer({ score: 0.85 }, async () => {
        const res = await runLesson(root, ['record', '--quality-gate', '--data', JSON.stringify(VALID_PAYLOAD)]);
        assert.equal(res.exitCode, null);
        assert.ok(res.logs.join('\n').includes('Quality score: 0.85/1.00'));
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('search --semantic prints relevance from DSPy ranking', async () => {
    const root = await makeRoot();
    try {
      const lessonId = await recordSeed(root);
      await withDspyServer({ results: [{ id: lessonId, score: 0.9 }] }, async () => {
        const res = await runLesson(root, ['search', 'Lockfile', '--semantic']);
        assert.equal(res.exitCode, null);
        const joined = res.logs.join('\n');
        assert.ok(joined.includes('[Relevance] 90%'), `relevance line expected, got: ${joined}`);
        assert.ok(joined.includes('semantic mode'), 'semantic mode label expected');
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
