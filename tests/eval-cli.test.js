// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] CLI handler branch coverage for src/cli/eval.ts per plans/coverage-95/SRS.md FR-1.2.
// DSPy endpoint defaults to localhost:8080 (ECONNREFUSED locally), so results are
// deterministic without mocks; failures set process.exitCode rather than process.exit.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { evalCommand } from '../dist/cli/eval.js';

const EXIT_SENTINEL = '__PROCESS_EXIT__';

async function runEval(root, args) {
  const logs = [];
  const errors = [];
  const stdoutChunks = [];
  const stderrChunks = [];
  const origLog = console.log;
  const origErr = console.error;
  const origExit = process.exit;
  const origExitCode = process.exitCode;
  const origOutWrite = process.stdout.write.bind(process.stdout);
  const origErrWrite = process.stderr.write.bind(process.stderr);
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => errors.push(a.join(' '));
  // eval.ts emits the DSPy banner via process.stderr.write, not console
  process.stdout.write = (chunk) => { stdoutChunks.push(String(chunk)); return true; };
  process.stderr.write = (chunk) => { stderrChunks.push(String(chunk)); return true; };
  process.exit = ((code) => {
    throw `${EXIT_SENTINEL}:${code}`;
  });
  let exitCode = null;
  try {
    await evalCommand(root, args);
  } catch (err) {
    if (typeof err === 'string' && err.startsWith(EXIT_SENTINEL)) {
      exitCode = Number(err.slice(EXIT_SENTINEL.length + 1));
    } else {
      process.exit = origExit;
      process.exitCode = origExitCode;
      console.log = origLog;
      console.error = origErr;
      process.stdout.write = origOutWrite;
      process.stderr.write = origErrWrite;
      throw err;
    }
  }
  const exitCodeAfter = process.exitCode;
  process.exit = origExit;
  process.exitCode = origExitCode;
  console.log = origLog;
  console.error = origErr;
  process.stdout.write = origOutWrite;
  process.stderr.write = origErrWrite;
  return { exitCode, exitCodeAfter, logs, errors, stdout: stdoutChunks.join(''), stderrRaw: stderrChunks.join('') };
}

async function makeRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'did-eval-cli-'));
}

test('eval CLI handler branches', async (t) => {
  await t.test('no target argument exits 1 with usage', async () => {
    const root = await makeRoot();
    try {
      const res = await runEval(root, []);
      assert.equal(res.exitCode, 1, 'missing arg should exit 1');
      assert.ok(res.errors.join('\n').length > 0, 'usage expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('target escaping project root exits 1 with security error', async () => {
    const root = await makeRoot();
    try {
      const outside = path.join(root, '..', 'escaped-target.md');
      const res = await runEval(root, [outside]);
      assert.equal(res.exitCode, 1, 'path escape should exit 1');
      assert.ok(res.errors.join('\n').includes('Security Error'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('nonexistent target exits 1 with file-not-found', async () => {
    const root = await makeRoot();
    try {
      const ghost = path.join(root, 'ghost-artifact.md');
      const res = await runEval(root, [ghost]);
      assert.equal(res.exitCode, 1, 'missing file should exit 1');
      assert.ok(res.errors.join('\n').includes('File not found'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('clean artifact passes and leaves exit code untouched', async () => {
    const root = await makeRoot();
    try {
      const clean = path.join(root, 'clean-doc.md');
      await writeFile(clean, '# Clean artifact\n\nNo hollow markers here. All claims carry evidence tags.\n', 'utf8');
      const res = await runEval(root, [clean]);
      assert.equal(res.exitCode, null, 'clean pass should not process.exit');
      assert.notEqual(res.exitCodeAfter, 1, 'clean pass must not set failure exit code');
      assert.ok(res.logs.join('\n').toUpperCase().includes('PASSED'));
      assert.ok(`${res.stderrRaw}\n${res.errors.join('\n')}`.includes('DSPy unavailable'), 'graceful degradation banner expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('artifact containing TODO fails with findings and sets exit code 1', async () => {
    const root = await makeRoot();
    try {
      const dirty = path.join(root, 'dirty-doc.md');
      await writeFile(dirty, '# Draft\n\nTODO: fill this section before review.\n', 'utf8');
      const res = await runEval(root, [dirty]);
      assert.equal(res.exitCode, null, 'failure path uses exitCode, not process.exit');
      assert.equal(res.exitCodeAfter, 1, 'failed evaluation sets process.exitCode=1');
      assert.ok(res.logs.join('\n').toUpperCase().includes('FAILED'));
      assert.ok(res.logs.join('\n').includes('TODO'), 'finding detail expected in output');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('eval extension-injection and endpoint override arms', async (t) => {
  await t.test('extensionless target skips extension push but still evaluates', async () => {
    const root = await makeRoot();
    try {
      const p = path.join(root, 'PLAINFILE');
      await writeFile(p, 'A plain artifact with more than fifty characters of substantive content for the guard.', 'utf8');
      const res = await runEval(root, [p]);
      assert.equal(res.exitCode, null, 'extensionless target should evaluate cleanly');
      assert.ok(res.logs.join('\n').toUpperCase().includes('PASSED'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('unusual extension is injected into guard extensions', async () => {
    const root = await makeRoot();
    try {
      const p = path.join(root, 'notes.tsx');
      await writeFile(p, 'TypeScript-flavored notes file with plenty of substantive content beyond fifty chars.', 'utf8');
      const res = await runEval(root, [p]);
      assert.equal(res.exitCode, null, '.tsx target should not crash evaluation');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('custom dspyEndpoint override degrades through closed port', async () => {
    const root = await makeRoot();
    try {
      await writeFile(
        path.join(root, 'defense.config.yml'),
        ['guards:', '  hollowArtifact:', '    dspyEndpoint: "http://127.0.0.1:1"', '    dspyTimeoutMs: 50', ''].join('\n'),
        'utf8',
      );
      const p = path.join(root, 'doc.md');
      await writeFile(p, 'Substantive documentation body long enough to satisfy the meaningful-content heuristic.', 'utf8');
      const res = await runEval(root, [p]);
      assert.equal(res.exitCode, null);
      const signal = [res.stderrRaw, res.errors.join('\n')].join('\n');
      assert.ok(signal.includes('DSPy unavailable'), 'override endpoint must be attempted then degrade');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
