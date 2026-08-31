// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] feedback.ts edge branches per plans/coverage-95/SRS.md FR-2.2:
// mixed-label F1 counting (L240-246 case bodies) and scraper rules R1/R2/R3
// (fix-up window TP, revert-window FN, guard-override FP).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { handleFeedbackCommand } from '../dist/cli/feedback.js';
import { computeF1FromFeedback, scanHistory } from '../dist/core/feedback.js';

const PERIOD = '2026-01-01T00:00:00Z/2027-01-01T00:00:00Z';

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function pick(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

test('computeF1FromFeedback counts mixed tp/fp/fn events correctly', async () => {
  const root = await makeRoot('did-f1-mixed-');
  try {
    const writes = [
      ['tp', '--guard', 'g', '--finding', 'alpha'],
      ['tp', '--guard', 'g', '--finding', 'beta'],
      ['fp', '--guard', 'g', '--finding', 'gamma'],
      ['fn', '--guard', 'g', '--finding', 'delta'],
    ];
    for (const args of writes) {
      await handleFeedbackCommand(root, args);
    }
    const metric = computeF1FromFeedback(root, 'g', PERIOD);
    assert.equal(pick(metric, 'tp', 'truePositives'), 2);
    assert.equal(pick(metric, 'fp', 'falsePositives'), 1);
    assert.equal(pick(metric, 'fn', 'falseNegatives'), 1);
    const f1 = Number(metric.f1);
    assert.ok(Math.abs(f1 - 2 / 3) < 0.001, `f1 should be 2/3, got ${f1}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function git(root, args, env = {}) {
  return execFileSync('git', args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function makeScraperRepo(prefix) {
  const root = await makeRoot(prefix);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'user.name', 'Test Runner']);
  const at = (iso) => ({
    GIT_AUTHOR_DATE: iso,
    GIT_COMMITTER_DATE: iso,
  });

  await writeFile(path.join(root, 'a.txt'), 'base content\n', 'utf8');
  git(root, ['add', 'a.txt']);
  git(root, ['commit', '-q', '--no-gpg-sign', '-m', 'chore: base'], at('2026-08-24T09:00:00Z'));

  await writeFile(path.join(root, 'a.txt'), 'patched content\n', 'utf8');
  git(root, ['add', 'a.txt']);
  git(root, ['commit', '-q', '--no-gpg-sign', '-m', 'fix(core): patch a'], at('2026-08-24T09:05:00Z'));
  const shaC2 = git(root, ['rev-parse', 'HEAD']).toString().trim();

  git(
    root,
    [
      'commit',
      '-q',
      '--allow-empty',
      '--no-gpg-sign',
      '-m',
      'revert: undo patch',
      '-m',
      `This reverts commit ${shaC2}.`,
    ],
    at('2026-08-24T09:10:00Z'),
  );

  git(
    root,
    [
      'commit',
      '-q',
      '--allow-empty',
      '--no-gpg-sign',
      '-m',
      'chore: misc',
      '-m',
      '[guard-override:hollow-artifact]',
    ],
    at('2026-08-24T09:15:00Z'),
  );

  return root;
}

test('scanHistory derives TP/FN/FP from fix-up, revert and override commits', async () => {
  const root = await makeScraperRepo('did-scrape-rules-');
  try {
    const result = await scanHistory(root, {});
    const proposed = result.proposed ?? [];
    assert.ok(
      proposed.some((e) => e.label === 'TP' && e.source === 'scraper-fixup'),
      'R1 fix-up within window should yield TP, got: ' + JSON.stringify(proposed),
    );
    assert.ok(
      proposed.some((e) => e.label === 'FN' && e.source === 'scraper-revert'),
      'R2 revert of scanned sha should yield FN',
    );
    assert.ok(
      proposed.some((e) => e.label === 'FP' && e.source === 'scraper-override'),
      'R3 guard-override marker should yield FP',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('scanHistory drops FN when reverted commit is absent from the scanned window', async () => {
  const root = await makeRoot('did-scraper-phantom-');
  const run = (args, env = {}) =>
    execFileSync('git', args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    run(['init', '-q']);
    run(['config', 'user.email', 't@example.com']);
    run(['config', 'user.name', 't']);
    const stamp = ['GIT_AUTHOR_DATE', '2026-08-24T09:00:00 +0000'];
    run(['commit', '--allow-empty', '-q', '--no-gpg-sign', '-m', 'chore: base'], Object.fromEntries([stamp, ['GIT_COMMITTER_DATE', stamp[1]]]));
    const phantomStamp = ['GIT_AUTHOR_DATE', '2026-08-24T09:05:00 +0000'];
    run(
      ['commit', '--allow-empty', '-q', '--no-gpg-sign', '-m', 'revert: undo patch', '-m', 'This reverts commit deadbeef00112233445566778899aabbccddeeff.'],
      Object.fromEntries([phantomStamp, ['GIT_COMMITTER_DATE', phantomStamp[1]]]),
    );

    const result = await scanHistory(root, {});
    const revertEvents = result.proposed.filter((p) => p.source === 'scraper-revert');
    assert.equal(revertEvents.length, 0, 'referenced sha absent -> no FN proposal');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
