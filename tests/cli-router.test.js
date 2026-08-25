// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] CLI router arms per plans/coverage-95/SRS.md FR-1.7.
// index.ts still invokes main() once at import; since the F-003 refactor
// main() reads argv at CALL time, so tests drive every arm directly.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const CLI = path.resolve('dist/cli/index.js');

function runCli(args) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_HINTS: '1' },
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

test('router behavioral contract via child process', async (t) => {
  await t.test('unknown command exits 1 with usage on stderr', () => {
    const res = runCli(['definitely-not-a-command']);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes('Unknown command'), `stderr: ${res.stderr}`);
    assert.ok(res.stderr.includes('Usage') || res.stdout.includes('Usage'));
  });

  await t.test('--version prints package version', () => {
    const res = runCli(['--version']);
    assert.equal(res.status, 0);
    assert.match(res.stdout.trim(), /^defense-in-depth v\d/);
  });

  await t.test('-v short flag mirrors --version', () => {
    const res = runCli(['-v']);
    assert.equal(res.status, 0);
    assert.match(res.stdout.trim(), /^defense-in-depth v\d/);
  });

  await t.test('--help prints usage and exits clean', () => {
    const res = runCli(['--help']);
    assert.equal(res.status, 0);
    assert.ok(res.stdout.toLowerCase().includes('usage'), `stdout: ${res.stdout}`);
  });
});

test('in-process router coverage via exported main() driven per arm', async (t) => {
  // Import once with a harmless arm (--version): index.ts still invokes main()
  // at module load, but now reads argv at CALL time so every later main()
  // call can drive its own arm. Static import would see node:test's argv.
  const EXIT_SENTINEL = '__PROCESS_EXIT__';
  const savedArgv = process.argv;
  const origCwd = process.cwd();
  const bootLogs = [];
  const origBootLog = console.log;
  console.log = (...a) => bootLogs.push(a.join(' '));
  process.argv = ['node', 'did', '--version'];
  let router;
  try {
    router = await import('../dist/cli/index.js');
  } finally {
    console.log = origBootLog;
    process.argv = savedArgv;
  }
  assert.ok(router && typeof router.main === 'function', 'main must be exported');
  assert.match(bootLogs.join('\n'), /^defense-in-depth v\d/, 'load-time run hits version arm');

  async function drive(args, cwd) {
    const logs = [];
    const errs = [];
    const raw = [];
    const oL = console.log;
    const oE = console.error;
    const oOut = process.stdout.write.bind(process.stdout);
    const oErrW = process.stderr.write.bind(process.stderr);
    const prevArgv = process.argv;
    const prevCwd = process.cwd();
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    // feedback usage prints via process.stdout.write, not console
    process.stdout.write = (c) => { raw.push(String(c)); return true; };
    process.stderr.write = (c) => { errs.push(String(c)); return true; };
    try {
      process.argv = ['node', 'did', ...args];
      if (cwd) process.chdir(cwd);
      await router.main();
      return { logs, errs, raw: raw.join(''), exitCode: null };
    } finally {
      console.log = oL;
      console.error = oE;
      process.stdout.write = oOut;
      process.stderr.write = oErrW;
      process.argv = prevArgv;
      if (cwd) process.chdir(prevCwd);
    }
  }

  async function driveExpectingExit(args, cwd) {
    const oExit = process.exit;
    process.exit = ((code) => {
      throw `${EXIT_SENTINEL}:${code}`;
    });
    try {
      const out = await drive(args, cwd);
      return { ...out, exitCode: undefined };
    } catch (err) {
      if (typeof err === 'string' && err.startsWith(EXIT_SENTINEL)) {
        return { logs: [], errs: [], exitCode: Number(err.slice(EXIT_SENTINEL.length + 1)) };
      }
      throw err;
    } finally {
      process.exit = oExit;
    }
  }

  async function makeGitRoot(prefix) {
    const root = await mkdtemp(path.join(os.tmpdir(), prefix));
    const run = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    run(['init', '-q']);
    run(['config', 'user.email', 'test@example.com']);
    run(['config', 'user.name', 'router-test']);
    run(['commit', '--allow-empty', '--no-gpg-sign', '-m', 'chore: seed router test']);
    return root;
  }

  await t.test('no args prints usage listing commands', async () => {
    const res = await drive([]);
    const joined = res.logs.join('\n').toLowerCase();
    assert.ok(joined.includes('usage'));
    assert.ok(joined.includes('doctor'));
  });

  await t.test('doctor arm runs report on current project', async () => {
    const root = await makeGitRoot('did-router-doctor-');
    try {
      const res = await drive(['doctor'], root);
      const joined = `${res.logs.join('\n')}${res.errs.join('\n')}`;
      assert.ok(joined.includes('doctor'), `output: ${joined.slice(0, 300)}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test("doctor --hints reset confirms cleared state", async () => {
    const root = await makeGitRoot('did-router-reset-');
    try {
      const res = await drive(['doctor', '--hints', 'reset'], root);
      const joined = `${res.logs.join('\n')}${res.errs.join('\n')}`.toLowerCase();
      assert.ok(joined.includes('clear'), `output: ${joined.slice(0, 300)}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('doctor --hints all stays silent under CI suppression', async () => {
    const root = await makeGitRoot('did-router-hintsall-');
    try {
      const res = await drive(['doctor', '--hints', 'all'], root);
      assert.equal(res.exitCode, null);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('doctor --hints dismiss without id exits 1', async () => {
    const root = await makeGitRoot('did-router-dismiss-');
    try {
      const res = await driveExpectingExit(['doctor', '--hints', 'dismiss'], root);
      assert.equal(res.exitCode, 1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('verify arm reports nothing-to-verify on clean repo', async () => {
    const root = await makeGitRoot('did-router-verify-');
    try {
      const res = await drive(['verify'], root);
      const joined = `${res.logs.join('\n')}${res.errs.join('\n')}`;
      assert.ok(joined.toLowerCase().includes('nothing to verify'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('feedback arm without subcommand prints usage without exiting', async () => {
    const res = await drive(['feedback']);
    assert.equal(res.exitCode, null);
    const signal = `${res.logs.join('\n')}\n${res.raw}\n${res.errs.join('\n')}`;
    assert.ok(signal.toLowerCase().includes('usage'));
  });

  await t.test('init arm installs hooks into the target project', async () => {
    const root = await makeGitRoot('did-router-init-');
    try {
      const res = await drive(['init'], root);
      assert.equal(res.exitCode, null);
      const hookPath = path.join(root, '.git', 'hooks', 'pre-commit');
      const hook = await readFile(hookPath, 'utf8');
      assert.ok(hook.includes('defense-in-depth'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('lesson bare command exits 1', async () => {
    const res = await driveExpectingExit(['lesson']);
    assert.equal(res.exitCode, 1);
  });

  await t.test('growth bare command exits 1', async () => {
    const res = await driveExpectingExit(['growth']);
    assert.equal(res.exitCode, 1);
  });

  await t.test('unknown command exits 1 through switch default', async () => {
    const res = await driveExpectingExit(['definitely-not-a-command']);
    assert.equal(res.exitCode, 1);
  });
});
