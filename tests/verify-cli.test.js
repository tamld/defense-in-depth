// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] verify command tail behavior per plans/coverage-95/SRS.md FR-1.8.
// Engine internals are covered by engine suites; this pins summary output,
// BLOCK exit code, hook-mode silence, and DSPy degradation banner.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { verify } from '../dist/cli/verify.js';

// verify's git helpers (staged files / branch / last commit) shell out to real
// git; a fake .git dir is not enough — commitFormat reads the last commit.
function makeGitRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix)).then((root) => {
    const run = (args) =>
      execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    run(['init', '-q']);
    run(['config', 'user.email', 'test@example.com']);
    run(['config', 'user.name', 'verify-cli-test']);
    run(['commit', '--allow-empty', '--no-gpg-sign', '-m', 'chore: seed repo for verify tests']);
    // hitlReview blocks protected defaults like master/main
    run(['checkout', '-b', 'feat/verify-cli-test']);
    return root;
  });
}

const EXIT_SENTINEL = '__PROCESS_EXIT__';

async function runVerify(root, args) {
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
    await verify(root, args);
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
    err: `${errors.join('\n')}`,
  };
}

async function makeRoot(prefix) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  await mkdir(path.join(root, '.git'), { recursive: true });
  return root;
}

test('verify without staged files or --files short-circuits politely', async (t) => {
  const root = await makeRoot('did-verify-nostage-');
  try {
    const res = await runVerify(root, []);
    assert.equal(res.exitCode, null);
    assert.ok(res.out.includes('Nothing to verify'), `out: ${res.out}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('verify reports a clean pass with summary line', async (t) => {
  const root = await makeGitRoot('did-verify-clean-');
  try {
    // Guard resolves paths as path.join(projectRoot, relPath): --files must be
    // relative to the project root, mirroring git staged-file semantics.
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'clean.md'),
      '# Real plan\n\nConcrete migration steps with evidence tags [CODE] and rollback notes for every phase.\n',
      'utf8',
    );
    const res = await runVerify(root, ['--files', 'docs/clean.md']);
    assert.equal(res.exitCode, null, `err: ${res.err}`);
    assert.ok(res.out.includes('guards passed'), `out: ${res.out}`);
    assert.ok(!res.out.includes('💡 Tip'), 'hint suppressed in CI environment');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('verify blocks on hollow artifacts and exits 1', async (t) => {
  const root = await makeRoot('did-verify-block-');
  try {
    const dirty = path.join(root, 'dirty.md');
    await writeFile(dirty, '# Plan\n\nTODO finish this section later\n', 'utf8');
    const res = await runVerify(root, ['--files', 'dirty.md']);
    assert.equal(res.exitCode, 1, 'hollow artifact must fail the gate');
    assert.ok(res.out.includes('🚫') || /hollow/i.test(res.out), `out: ${res.out}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hook mode stays silent even without CI suppression', async (t) => {
  const root = await makeRoot('did-verify-hook-');
  const savedCI = process.env.CI;
  try {
    delete process.env.CI;
    process.env.NO_HINTS = '1';
    const res = await runVerify(root, ['--hook', 'pre-commit']);
    assert.equal(res.exitCode, null, `err: ${res.err}`);
    assert.ok(!res.out.includes('💡 Tip'), 'no interactive hint in hook mode');
  } finally {
    if (savedCI === undefined) delete process.env.CI;
    else process.env.CI = savedCI;
    await rm(root, { recursive: true, force: true });
  }
});

test('DSPy-forced config degrades with banner instead of failing', async (t) => {
  const root = await makeGitRoot('did-verify-dspybanner-');
  try {
    await writeFile(
      path.join(root, 'defense.config.yml'),
      'guards:\n  hollowArtifact:\n    enabled: true\n    useDspy: true\n',
      'utf8',
    );
    await mkdir(path.join(root, 'docs'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'doc.md'),
      '# Design note\n\nSubstantive design rationale with concrete steps so deterministic checks pass and the DSPy semantic path actually runs.\n',
      'utf8',
    );
    const res = await runVerify(root, ['--files', 'docs/doc.md']);
    assert.equal(res.exitCode, null, `err: ${res.err}`);
    assert.ok(
      res.err.includes('DSPy unavailable'),
      `stderr: ${res.err}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
