// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] ticketIdentity provider timeout/catch isolation per plans/coverage-95/SRS.md FR-2.5.
// A hanging or failing provider must never crash the pipeline run.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DefendEngine } from '../dist/core/engine.js';
import { loadConfig } from '../dist/core/config-loader.js';

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

function configWithProvider(base, providerConfig) {
  return {
    ...base,
    guards: {
      ...base.guards,
      ticketIdentity: {
        enabled: true,
        severity: 'warn',
        provider: 'http',
        ...providerConfig,
      },
    },
  };
}

function observerCapturingTicket() {
  const observed = {};
  const guard = {
    id: 'observer',
    name: 'observer',
    async check(ctx) {
      observed.ticket = ctx.ticket;
      return { guardId: 'observer', passed: true, findings: [], durationMs: 1 };
    },
  };
  return { guard, observed };
}

test('engine survives hanging and throwing ticket providers', async (t) => {
  await t.test('non-routable endpoint with tiny timeout falls back to basicRef with warn', async () => {
    const root = await makeRoot('did-eng-timeout-');
    try {
      const base = await loadConfig(root);
      const engine = new DefendEngine(
        root,
        configWithProvider(base, {
          providerConfig: {
            endpoint: 'http://10.255.255.1:81/api/tickets',
            timeout: 50,
          },
        }),
      );
      const { guard, observed } = observerCapturingTicket();
      engine.use(guard);

      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...a) => warnings.push(a.join(' '));
      let verdict;
      try {
        verdict = await engine.run({ files: [], branch: 'feat/TK-TIMEOUT' });
      } finally {
        console.warn = origWarn;
      }

      assert.ok(verdict, 'run must complete despite provider hang');
      assert.equal(observed.ticket?.id, 'TK-TIMEOUT');
      assert.equal(observed.ticket?.phase, undefined);
      assert.ok(warnings.join('\n').includes('Failed to resolve'), 'provider self-warn expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('fetch-rejecting provider isolates via catch path', async () => {
    const root = await makeRoot('did-eng-throw-');
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('network unreachable');
    };
    try {
      const base = await loadConfig(root);
      const engine = new DefendEngine(
        root,
        configWithProvider(base, {
          providerConfig: { endpoint: 'http://stub-api/tickets', timeout: 500 },
        }),
      );
      const { guard, observed } = observerCapturingTicket();
      engine.use(guard);

      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...a) => warnings.push(a.join(' '));
      let verdict;
      try {
        verdict = await engine.run({ files: [], branch: 'fix/TK-THROW' });
      } finally {
        console.warn = origWarn;
        globalThis.fetch = origFetch;
      }

      assert.ok(verdict);
      assert.equal(observed.ticket?.id, 'TK-THROW');
      assert.ok(warnings.join('\n').includes('Failed to resolve'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('injected rejecting provider hits engine catch warn', async () => {
    const root = await makeRoot('did-eng-inject-');
    try {
      const base = await loadConfig(root);
      const failing = {
        name: 'failing',
        resolve: async () => {
          throw new Error('boom');
        },
      };
      // F-004 resolution: the injection hook makes the ENGINE-level catch
      // honestly reachable (built-in providers self-catch and never throw).
      const engine = new DefendEngine(root, configWithProvider(base, {}), {
        ticketProviderFactory: () => failing,
      });
      const { guard, observed } = observerCapturingTicket();
      engine.use(guard);

      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...a) => warnings.push(a.join(' '));
      let verdict;
      try {
        verdict = await engine.run({ files: [], branch: 'feat/TK-INJECT' });
      } finally {
        console.warn = origWarn;
      }

      assert.ok(verdict, 'run must complete via basicRef fallback');
      assert.equal(observed.ticket?.id, 'TK-INJECT');
      assert.ok(warnings.join('\n').includes('⚠ Ticket provider'), 'engine warn expected');
      assert.ok(warnings.join('\n').includes('failed for'), 'engine catch message expected');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
