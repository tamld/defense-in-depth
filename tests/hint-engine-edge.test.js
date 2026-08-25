// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] Hint-engine rule branch coverage per plans/coverage-95/SRS.md FR residual wave T012.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateHints } from '../dist/core/hint-engine.js';
import { loadHintState, recordHintShown } from '../dist/core/hint-state.js';
import { handleFeedbackCommand } from '../dist/cli/feedback.js';

function git(root, args, extraEnv = {}) {
  execFileSync('git', args, {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, ...extraEnv },
  });
}

async function makeRepo(prefix, commitCount = 5, secondAuthor = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 't@example.com']);
  git(root, ['config', 'user.name', 't']);
  for (let i = 0; i < commitCount; i += 1) {
    const env = secondAuthor && i === commitCount - 1
      ? { GIT_AUTHOR_NAME: 'other', GIT_AUTHOR_EMAIL: 'o@example.com', GIT_COMMITTER_NAME: 'other', GIT_COMMITTER_EMAIL: 'o@example.com' }
      : {};
    git(root, ['commit', '--allow-empty', '--no-gpg-sign', '-q', `-m chore: seed ${i}`], env);
  }
  return root;
}

async function writeFeedbackTp(root) {
  const origExit = process.exit;
  const origLog = console.log;
  const origErr = console.error;
  process.exit = () => {
    throw '__PROCESS_EXIT__:1';
  };
  console.log = () => {};
  console.error = () => {};
  try {
    await handleFeedbackCommand(root, ['tp', '--guard', 'hollow-artifact', '--finding', 'recent block marker']);
  } finally {
    process.exit = origExit;
    console.log = origLog;
    console.error = origErr;
  }
}

const idsOf = (hints) => hints.map((h) => h.id);

test('hint rules branch on repo shape', async (t) => {
  await t.test('H001 fires on dspy-less repo with >=5 commits', async () => {
    const root = await makeRepo('did-hint-h001-');
    try {
      const eligible = idsOf(await evaluateHints({ projectRoot: root, state: loadHintState(root) }));
      assert.ok(eligible.includes('H-001-no-dspy'), `got ${eligible}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('H004 fires when docs exist and contributors exceed one', async () => {
    const root = await makeRepo('did-hint-h004-', 3, true);
    try {
      await mkdir(path.join(root, 'docs'), { recursive: true });
      await writeFile(path.join(root, 'CHANGELOG.md'), '# Changelog\n', 'utf8');
      const eligible = idsOf(await evaluateHints({ projectRoot: root, state: loadHintState(root) }));
      assert.ok(eligible.includes('H-004-no-federation'), `got ${eligible}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('H002 fires on recent TP feedback without lessons', async () => {
    const root = await makeRepo('did-hint-h002-', 5);
    try {
      await writeFeedbackTp(root);
      const eligible = idsOf(await evaluateHints({ projectRoot: root, state: loadHintState(root) }));
      assert.ok(eligible.includes('H-002-no-lessons'), `got ${eligible}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('cooldown boundary: shown hint excluded at 30d, re-included at 0d', async () => {
    const root = await makeRepo('did-hint-cool-');
    try {
      recordHintShown(root, 'H-001-no-dspy');
      const cooled = idsOf(await evaluateHints({ projectRoot: root, state: loadHintState(root), cooldownDays: 30 }));
      assert.ok(!cooled.includes('H-001-no-dspy'), 'within cooldown must be excluded');
      const reset = idsOf(await evaluateHints({ projectRoot: root, state: loadHintState(root), cooldownDays: 0 }));
      assert.ok(reset.includes('H-001-no-dspy'), 'zero cooldown re-admits hint');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
