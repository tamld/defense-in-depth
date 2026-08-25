// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] root-pollution nested-path skip + allowlist arms per plans/coverage-95/SRS.md FR-3.3.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rootPollutionGuard } from '../dist/guards/root-pollution.js';

function ctxFor(stagedFiles, guardConfig) {
  return {
    projectRoot: '/tmp/did-rp-edge',
    stagedFiles,
    config: { guards: { rootPollution: guardConfig } },
  };
}

test('root-pollution skips nested paths and honors allowlist arms', async (t) => {
  await t.test('nested files never trigger root findings', async () => {
    const res = await rootPollutionGuard.check(
      ctxFor(['docs/deep/nested.md', 'src/core/engine.ts'], {}),
    );
    assert.equal(res.passed, true);
    assert.equal(res.findings.length, 0);
  });

  await t.test('explicit allowedRootFiles entry passes a root file', async () => {
    const res = await rootPollutionGuard.check(
      ctxFor(['README.md'], { allowedRootFiles: ['README.md'] }),
    );
    assert.equal(res.passed, true);
    assert.equal(res.findings.length, 0);
  });

  await t.test('allowedRootPatterns glob admits matching root files', async () => {
    const res = await rootPollutionGuard.check(
      ctxFor(['NOTES.md'], { allowedRootPatterns: ['*.md'] }),
    );
    assert.equal(res.findings.length, 0);
  });

  await t.test('dotfile pattern arm admits hidden root files', async () => {
    const res = await rootPollutionGuard.check(
      ctxFor(['.nvmrc'], { allowedRootPatterns: ['.*'] }),
    );
    assert.equal(res.findings.length, 0);
  });

  await t.test('unlisted root file still produces a BLOCK finding', async () => {
    const res = await rootPollutionGuard.check(ctxFor(['random-draft.md'], {}));
    assert.equal(res.passed, false);
    assert.equal(res.findings.length, 1);
    assert.match(res.findings[0].message, /NOT allowed at the project root/);
  });
});
