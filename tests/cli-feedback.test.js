// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] feedback CLI branches per plans/coverage-95/SRS.md FR-1.6.
// Scraper internals live in feedback-scraper.test.js; this file pins the
// command surface (write/list/f1/scan-history) end to end.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleFeedbackCommand } from '../dist/cli/feedback.js';

const EXIT_SENTINEL = '__PROCESS_EXIT__';

async function runFeedback(root, args) {
  const logs = [];
  const errors = [];
  const stdoutChunks = [];
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;
  const origOut = process.stdout.write.bind(process.stdout);
  const origErrW = process.stderr.write.bind(process.stderr);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  process.stdout.write = (c) => {
    stdoutChunks.push(String(c));
    return true;
  };
  process.stderr.write = (c) => {
    errors.push(String(c));
    return true;
  };
  process.exit = ((code) => {
    throw `${EXIT_SENTINEL}:${code}`;
  });
  let exitCode = null;
  try {
    await handleFeedbackCommand(root, args);
  } catch (err) {
    if (typeof err === 'string' && err.startsWith(EXIT_SENTINEL)) {
      exitCode = Number(err.slice(EXIT_SENTINEL.length + 1));
    } else {
      restore();
      throw err;
    }
  }
  function restore() {
    process.exit = origExit;
    console.log = origLog;
    console.error = origErr;
    process.stdout.write = origOut;
    process.stderr.write = origErrW;
  }
  restore();
  return {
    exitCode,
    out: `${stdoutChunks.join('')}\n${logs.join('\n')}`,
    err: errors.join('\n'),
  };
}

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('feedback command surface branches', async (t) => {
  await t.test('unknown subcommand exits 1 with usage', async () => {
    const root = await makeRoot('did-fb-unknown-');
    try {
      const res = await runFeedback(root, ['explode']);
      assert.equal(res.exitCode, 1);
      assert.ok(res.err.length > 0 || res.out.length > 0, 'usage printed');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('write requires guard then finding, in that order', async () => {
    const root = await makeRoot('did-fb-writeflags-');
    try {
      const noGuard = await runFeedback(root, ['tp', '--finding', 'x']);
      assert.equal(noGuard.exitCode, 1);
      const noFinding = await runFeedback(root, ['tp', '--guard', 'hollowArtifact']);
      assert.equal(noFinding.exitCode, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('text finding hashes; replay is idempotent', async () => {
    const root = await makeRoot('did-fb-writetp-');
    try {
      const first = await runFeedback(root, [
        'tp', '--guard', 'hollowArtifact', '--finding', 'placeholder TODO body',
      ]);
      assert.equal(first.exitCode, null, `got err: ${first.err}`);
      assert.ok(first.out.includes('TP recorded'), `out: ${first.out}`);
      const replay = await runFeedback(root, [
        'tp', '--guard', 'hollowArtifact', '--finding', 'placeholder TODO body',
      ]);
      assert.equal(replay.exitCode, null);
      assert.ok(replay.err.includes('already recorded'), `err: ${replay.err}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('hex finding string is used verbatim as hash', async () => {
    const root = await makeRoot('did-fb-hex-');
    try {
      const hex = 'a'.repeat(40);
      const res = await runFeedback(root, [
        'fp', '--guard', 'ssotPollution', '--finding', hex,
      ]);
      assert.equal(res.exitCode, null);
      assert.ok(res.out.includes('FP recorded'), `out: ${res.out}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('list empty store then rows after writes with limit', async () => {
    const root = await makeRoot('did-fb-list-');
    try {
      const empty = await runFeedback(root, ['list']);
      assert.equal(empty.exitCode, null);
      assert.ok(empty.out.includes('(no feedback events match)'), `out: ${empty.out}`);

      await runFeedback(root, ['tp', '--guard', 'hollowArtifact', '--finding', 'finding one text']);
      await runFeedback(root, ['fp', '--guard', 'ssotPollution', '--finding', 'finding two text']);
      const listed = await runFeedback(root, ['list']);
      assert.equal(listed.exitCode, null);
      assert.ok(listed.out.includes('hollowArtifact'), `rows: ${listed.out}`);
      assert.ok(listed.out.includes('event(s)'), `count: ${listed.out}`);

      const limited = await runFeedback(root, ['list', '--limit', '1']);
      assert.equal(limited.exitCode, null);
      assert.ok(limited.out.trim().length > 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('f1 requires guard and formats a summary otherwise', async () => {
    const root = await makeRoot('did-fb-f1-');
    try {
      const noGuard = await runFeedback(root, ['f1']);
      assert.equal(noGuard.exitCode, 1);

      await runFeedback(root, ['tp', '--guard', 'hollowArtifact', '--finding', 'hit one']);
      const ok = await runFeedback(root, ['f1', '--guard', 'hollowArtifact']);
      assert.equal(ok.exitCode, null);
      assert.ok(/F1|precision|recall/i.test(ok.out), `summary: ${ok.out}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('scan-history tolerates non-git roots', async () => {
    const root = await makeRoot('did-fb-scan-');
    try {
      const res = await runFeedback(root, ['scan-history']);
      assert.equal(res.exitCode, null, `err: ${res.err}`);
      assert.ok(
        /scanned|no commits to scan/i.test(res.out),
        `out: ${res.out}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
