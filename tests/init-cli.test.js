// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] CLI handler branch coverage for src/cli/init.ts per plans/coverage-95/SRS.md FR-1.3.
// The config template-copy branch depends on templates/defense.config.yml being
// present relative to dist/, i.e. tests must run inside a repository checkout.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { init } from '../dist/cli/init.js';

const EXIT_SENTINEL = '__PROCESS_EXIT__';

async function runInit(root) {
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  process.exit = ((code) => {
    throw `${EXIT_SENTINEL}:${code}`;
  });
  let exitCode = null;
  try {
    await init(root);
  } catch (err) {
    if (typeof err === 'string' && err.startsWith(EXIT_SENTINEL)) {
      exitCode = Number(err.slice(EXIT_SENTINEL.length + 1));
    } else {
      process.exit = origExit;
      console.log = origLog;
      console.error = origErr;
      throw err;
    }
  }
  process.exit = origExit;
  console.log = origLog;
  console.error = origErr;
  return { exitCode, logs, errors };
}

async function makeRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'did-init-cli-'));
}

async function seedGitDir(root) {
  await mkdir(path.join(root, '.git'), { recursive: true });
}

test('init CLI branches', async (t) => {
  await t.test('directory without .git exits 1', async () => {
    const root = await makeRoot();
    try {
      const res = await runInit(root);
      assert.equal(res.exitCode, 1, 'non-git directory should be rejected');
      assert.ok((res.errors.join('\n') + res.logs.join('\n')).includes('Not a Git repository'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('fresh install writes executable hooks and config', async () => {
    const root = await makeRoot();
    try {
      await seedGitDir(root);
      const res = await runInit(root);
      assert.equal(res.exitCode, null, 'fresh install should succeed');

      const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
      const hookStat = await stat(hookPath);
      assert.ok(hookStat.mode & 0o111, 'hook should be executable');

      const hookBody = await readFile(hookPath, 'utf8');
      assert.ok(hookBody.includes('defense-in-depth'), 'hook must invoke defense-in-depth');

      await stat(path.join(root, '.git', 'hooks', 'pre-push'));
      await stat(path.join(root, 'defense.config.yml'));
      assert.ok(res.logs.join('\n').includes('pre-commit'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('re-run updates own hooks and skips existing config', async () => {
    const root = await makeRoot();
    try {
      await seedGitDir(root);
      await runInit(root);
      const second = await runInit(root);
      assert.equal(second.exitCode, null, 're-init should stay idempotent-successful');
      const joined = second.logs.join('\n');
      assert.ok(joined.includes('Updated'), 'owned hook should be updated in place');
      assert.ok(joined.includes('already exists'), 'existing config must be skipped, not clobbered');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('foreign hook is preserved and appended, not replaced', async () => {
    const root = await makeRoot();
    try {
      await seedGitDir(root);
      const hooksDir = path.join(root, '.git', 'hooks');
      await mkdir(hooksDir, { recursive: true });
      const foreignPath = path.join(hooksDir, 'pre-commit');
      await writeFile(foreignPath, '#!/bin/sh\necho "custom lint gate"\n', 'utf8');
      await chmod(foreignPath, 0o755);

      const res = await runInit(root);
      assert.equal(res.exitCode, null, 'foreign-hook coexistence should succeed');
      assert.ok(res.logs.join('\n').includes('Appended'), 'append branch message expected');

      const body = await readFile(foreignPath, 'utf8');
      assert.ok(body.includes('custom lint gate'), 'original hook body preserved');
      assert.ok(body.includes('defense-in-depth'), 'defense-in-depth section appended');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
