// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] hints-emit suppression gates + formatting per plans/coverage-95/SRS.md FR-1.5.
// Real emission depends on evaluateHints eligibility (covered by hint-engine suites);
// these tests pin the deterministic gates and the output contract.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  emitOneHint,
  emitAllHints,
  formatHint,
  isChannelEnabled,
} from '../dist/cli/hints-emit.js';

const SAMPLE_HINT = {
  id: 'H-001-no-dspy',
  body: 'Enable DSPy semantic evaluation for deeper artifact analysis.',
};

function withEnv(overrides, fn) {
  const saved = {
    CI: process.env.CI,
    NO_HINTS: process.env.NO_HINTS,
    NO_COLOR: process.env.NO_COLOR,
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    });
}

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

test('formatHint renders plain text with dismissal footer outside TTY', () => {
  const text = formatHint(SAMPLE_HINT);
  assert.ok(text.includes('💡 Tip: Enable DSPy'));
  assert.ok(text.includes(`did doctor --hints dismiss ${SAMPLE_HINT.id}`));
  assert.ok(text.includes('NO_HINTS=1'));
  assert.ok(!text.includes('\x1b['), 'no ANSI color codes on non-TTY stderr');
});

test('formatHint applies dim ANSI wrap when stderr is a TTY and NO_COLOR unset', async () => {
  const savedIsTTY = process.stderr.isTTY;
  const savedNoColor = process.env.NO_COLOR;
  process.stderr.isTTY = true;
  delete process.env.NO_COLOR;
  try {
    const text = formatHint(SAMPLE_HINT);
    assert.ok(text.includes('\x1b[2m'), 'dim ANSI prefix expected on TTY stderr');
    assert.ok(text.includes('💡 Tip:'), 'tip body expected');
  } finally {
    if (savedIsTTY === undefined) delete process.stderr.isTTY;
    else process.stderr.isTTY = savedIsTTY;
    if (savedNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = savedNoColor;
  }
});

test('cooldownDays config override disables cooldown suppression', async () => {
  const { execFileSync } = await import('node:child_process');
  const { writeFile } = await import('node:fs/promises');
  const root = await makeRoot('did-hint-cd0-');
  const run = (args) => execFileSync('git', args, { cwd: root });
  const savedErrWrite = process.stderr.write.bind(process.stderr);
  try {
    run(['init', '-q']);
    run(['config', 'user.email', 't@e.com']);
    run(['config', 'user.name', 'T']);
    for (let i = 0; i < 5; i++) {
      run(['commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', `chore: seed ${i}`]);
    }
    await writeFile(path.join(root, 'defense.config.yml'), 'hints:\n  cooldownDays: 0\n', 'utf8');
    await withEnv({ CI: 'false', NO_HINTS: undefined }, async () => {
      process.stderr.write = () => true;
      const first = await emitOneHint(root, 'doctor');
      assert.ok(first, 'first emit should fire');
      const replay = await emitOneHint(root, 'doctor');
      assert.ok(replay && replay.id === first.id, 'cooldownDays:0 must allow immediate re-emission of same hint');
    });
  } finally {
    process.stderr.write = savedErrWrite;
    await rm(root, { recursive: true, force: true });
  }
});

test('isChannelEnabled honors config defaults and overrides', async (t) => {
  await t.test('default config enables standard channels', async () => {
    const root = await makeRoot('did-hint-chan-default-');
    try {
      assert.equal(isChannelEnabled(root, 'doctor'), true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('enabled:false disables every channel', async () => {
    const root = await makeRoot('did-hint-chan-off-');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(root, { recursive: true });
      await writeFile(
        path.join(root, 'defense.config.yml'),
        'hints:\n  enabled: false\n',
        'utf8',
      );
      assert.equal(isChannelEnabled(root, 'doctor'), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('emitOneHint suppresses deterministically via env and channel gates', async (t) => {
  await t.test('CI=true suppresses emission', async () => {
    const root = await makeRoot('did-hint-ci-');
    try {
      await withEnv({ CI: 'true', NO_HINTS: undefined }, async () => {
        assert.equal(await emitOneHint(root, 'doctor'), null);
        assert.equal((await emitAllHints(root, 'doctor')).length, 0);
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('NO_HINTS=1 suppresses emission', async () => {
    const root = await makeRoot('did-hint-nohints-');
    try {
      await withEnv({ CI: 'false', NO_HINTS: '1' }, async () => {
        assert.equal(await emitOneHint(root, 'doctor'), null);
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('channel disabled by config suppresses before eligibility check', async () => {
    const root = await makeRoot('did-hint-channeloff-');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(root, 'defense.config.yml'),
        'hints:\n  channels:\n    - verify-success\n',
        'utf8',
      );
      await withEnv({ CI: 'false', NO_HINTS: undefined }, async () => {
        assert.equal(await emitOneHint(root, 'doctor'), null);
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('emission success path fires once then cools down', async (t) => {
  await t.test('eligible H-001 hint is emitted to stderr and recorded', async () => {
    const { execFileSync } = await import('node:child_process');
    const root = await makeRoot('did-hint-emitted-');
    const origErrWrite = process.stderr.write.bind(process.stderr);
    const chunks = [];
    try {
      execFileSync('git', ['init', '-q'], { cwd: root });
      execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
      execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
      for (let i = 0; i < 5; i++) {
        execFileSync(
          'git',
          ['commit', '-q', '--allow-empty', '--no-gpg-sign', '-m', `chore: seed ${i}`],
          { cwd: root },
        );
      }
      await withEnv({ CI: 'false', NO_HINTS: undefined }, async () => {
        process.stderr.write = (chunk) => {
          chunks.push(String(chunk));
          return true;
        };
        const hint = await emitOneHint(root, 'doctor');
        process.stderr.write = origErrWrite;
        assert.ok(hint, 'first call should emit an eligible hint');
        assert.equal(hint.id, 'H-001-no-dspy');
        assert.ok(chunks.join('').includes('💡 Tip:'), 'formatted tip expected on stderr');
        const second = await emitOneHint(root, 'doctor');
        assert.equal(second, null, 'cooldown must suppress immediate replay');
      });
    } finally {
      process.stderr.write = origErrWrite;
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('emitAllHints fans out every eligible hint once, then cools down', async () => {
  const { execFileSync: efs } = await import('node:child_process');
  const root = await mkdtemp(path.join(os.tmpdir(), 'did-hint-fanout-'));
  const run = (args) => efs('git', args, { cwd: root });
  const savedErrWrite = process.stderr.write.bind(process.stderr);
  const chunks = [];
  try {
    run(['init', '-q']);
    run(['config', 'user.email', 't@example.com']);
    run(['config', 'user.name', 't']);
    for (let i = 0; i < 5; i += 1) {
      run(['commit', '--allow-empty', '-q', '--no-gpg-sign', '-m', `chore: seed ${i}`]);
    }
    await withEnv({ CI: 'false', NO_HINTS: undefined }, async () => {
      process.stderr.write = (chunk) => {
        chunks.push(String(chunk));
        return true;
      };
      const first = await emitAllHints(root, 'doctor');
      assert.ok(Array.isArray(first) && first.length >= 1, 'at least H-001 should fan out');
      assert.ok(first.some((h) => h.id === 'H-001-no-dspy'));
      assert.ok(chunks.join('').split('💡 Tip:').length >= 2, 'one footer per emitted hint');
      const second = await emitAllHints(root, 'doctor');
      assert.equal(second.length, 0, 'cooldown suppresses immediate refanout');
    });
  } finally {
    process.stderr.write = savedErrWrite;
    await rm(root, { recursive: true, force: true });
  }
});
