// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] CLI router arms per plans/coverage-95/SRS.md FR-1.7.
// index.ts executes main() at import using process.argv; ESM evaluates a
// module once per process, so exactly one arm earns in-process coverage
// credit (no-args usage). All other arms are proven via child-process spawns.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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

test('in-process router credit for the single safe arm ESM allows', async (t) => {
  await t.test('no-args import runs main() -> printUsage (one honest ESM evaluation)', async () => {
    const savedArgv = process.argv;
    const origCwd = process.cwd();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'did-router-arm-'));
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      // Plain specifier only: query-string imports create separate module URLs
      // whose V8 coverage never rolls into the base dist/cli/index.js row.
      process.argv = ['node', 'did'];
      process.chdir(tmp);
      await import('../dist/cli/index.js');
      const joined = logs.join('\n');
      assert.ok(joined.toLowerCase().includes('usage'), `logs: ${joined.slice(0, 400)}`);
      assert.ok(joined.includes('doctor'), 'usage lists commands');
    } finally {
      process.chdir(origCwd);
      process.argv = savedArgv;
      console.log = origLog;
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
