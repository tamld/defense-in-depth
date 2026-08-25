// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] doctor command branches per plans/coverage-95/SRS.md FR-1.4.
// Hint emission inside doctor is CI-suppressed here (CI=true in test env),
// which is exactly the deterministic gate hints-emit tests pin separately.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { doctor } from '../dist/cli/doctor.js';

const EXIT_SENTINEL = '__PROCESS_EXIT__';

async function runDoctor(root, options = undefined) {
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
    await doctor(root, options);
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
  return { exitCode, logs, errors, stdout: stdoutChunks.join('') };
}

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('doctor reports degraded environments honestly', async (t) => {
  await t.test('bare directory lists git/config/hook issues', async () => {
    const root = await makeRoot('did-doctor-bare-');
    try {
      const res = await runDoctor(root);
      assert.equal(res.exitCode, null, 'doctor reports, it does not exit');
      const joined = `${res.stdout}\n${res.logs.join('\n')}\n${res.errors.join('\n')}`;
      assert.ok(joined.includes('defense-in-depth doctor'));
      assert.ok(joined.includes('Not a Git repository'));
      assert.ok(joined.includes('issue'), 'issue count expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('fully provisioned project passes all checks', async () => {
    const root = await makeRoot('did-doctor-clean-');
    try {
      await mkdir(path.join(root, '.git', 'hooks'), { recursive: true });
      for (const hook of ['pre-commit', 'pre-push']) {
        await writeFile(
          path.join(root, '.git', 'hooks', hook),
          '#!/bin/sh\n# installed by defense-in-depth\nnpx defense-in-depth verify\n',
          'utf8',
        );
      }
      await writeFile(
        path.join(root, 'defense.config.yml'),
        'guards:\n  hollowArtifact:\n    enabled: true\n',
        'utf8',
      );
      const res = await runDoctor(root);
      assert.equal(res.exitCode, null);
      const joined = `${res.stdout}\n${res.logs.join('\n')}`;
      assert.ok(joined.includes('All checks passed'), `got: ${joined}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('doctor --hints subcommands behave deterministically', async (t) => {
  await t.test('dismiss without id exits 1 with usage', async () => {
    const root = await makeRoot('did-doctor-dismissnoarg-');
    try {
      const res = await runDoctor(root, { hintsAction: 'dismiss' });
      assert.equal(res.exitCode, 1);
      assert.ok(res.errors.join('').includes('Usage'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('dismiss unknown id exits 1 listing known hints', async () => {
    const root = await makeRoot('did-doctor-dismissbad-');
    try {
      const res = await runDoctor(root, { hintsAction: 'dismiss', hintsActionArg: 'H-999-nope' });
      assert.equal(res.exitCode, 1);
      const joined = res.errors.join('');
      assert.ok(joined.includes('Unknown hint id'), `got: ${joined}`);
      assert.ok(joined.includes('H-001'), 'known ids listed');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('reset clears state and confirms', async () => {
    const root = await makeRoot('did-doctor-reset-');
    try {
      const res = await runDoctor(root, { hintsAction: 'reset' });
      assert.equal(res.exitCode, null);
      const joined = `${res.stdout}\n${res.logs.join('\n')}\n${res.errors.join('')}`;
      assert.ok(joined.toLowerCase().includes('cleared') || joined.includes('✅'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('hintsAction all is suppressed under CI but does not crash', async () => {
    const root = await makeRoot('did-doctor-allhints-');
    try {
      const res = await runDoctor(root, { hintsAction: 'all' });
      assert.equal(res.exitCode, null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
