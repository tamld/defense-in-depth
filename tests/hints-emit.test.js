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
