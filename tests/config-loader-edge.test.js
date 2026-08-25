// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] Config-loader deepMerge/parse-error edges per plans/coverage-95/SRS.md T012.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, DEFAULT_CONFIG } from '../dist/core/config-loader.js';

async function rootWithConfig(prefix, yaml) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  await writeFile(path.join(root, 'defense.config.yml'), yaml, 'utf8');
  return root;
}

test('loadConfig deep-merges user config over defaults', async (t) => {
  await t.test('array values replace defaults instead of merging', async () => {
    const root = await rootWithConfig(
      'did-cfg-array-',
      ['guards:', '  hollowArtifact:', '    extensions: [".tsx"]', ''].join('\n'),
    );
    try {
      const cfg = loadConfig(root);
      assert.deepEqual(cfg.guards.hollowArtifact.extensions, ['.tsx']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('nested objects merge key-by-key with defaults intact', async () => {
    const root = await rootWithConfig(
      'did-cfg-nested-',
      ['guards:', '  hollowArtifact:', '    severity: warn', ''].join('\n'),
    );
    try {
      const cfg = loadConfig(root);
      assert.equal(cfg.guards.hollowArtifact.severity, 'warn');
      assert.equal(cfg.guards.hollowArtifact.enabled, true, 'sibling default keys survive merge');
      assert.ok(cfg.guards.ssotPollution, 'unrelated default guard intact');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('malformed YAML surfaces a thrown error', async () => {
    const root = await rootWithConfig('did-cfg-bad-', '{broken: [[[\n');
    try {
      assert.throws(() => loadConfig(root));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('missing config returns pristine defaults', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'did-cfg-empty-'));
    try {
      const cfg = loadConfig(root);
      assert.deepEqual(cfg.version, DEFAULT_CONFIG.version);
      assert.ok(cfg.guards.hollowArtifact);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('DEFAULT_CONFIG export is a complete frozen-ish baseline object', () => {
  assert.ok(DEFAULT_CONFIG && typeof DEFAULT_CONFIG === 'object');
  assert.ok(DEFAULT_CONFIG.version);
  assert.ok(DEFAULT_CONFIG.guards.hollowArtifact);
});
