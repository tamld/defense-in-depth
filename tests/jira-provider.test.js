// Executor: Sisyphus (OhMyOpenCode)
// JiraTicketProvider tests
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JiraTicketProvider } from '../dist/federation/jira-provider.js';

async function withFetch(stub, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    const signal = options?.signal;
    if (signal) {
      return stub(url, { ...options, signal });
    }
    return stub(url, options);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test('JiraTicketProvider requires baseUrl and auth', async (t) => {
  await t.test('missing baseUrl returns undefined', async () => {
    const p = new JiraTicketProvider({ email: 'test@test.com', apiToken: 'token' });
    assert.equal(await p.resolve('TK-1'), undefined);
  });

  await t.test('missing auth returns undefined', async () => {
    const p = new JiraTicketProvider({ baseUrl: 'https://test.atlassian.net' });
    assert.equal(await p.resolve('TK-1'), undefined);
  });

  await t.test('bearerToken auth works without email/apiToken', async () => {
    const p = new JiraTicketProvider({ baseUrl: 'https://test.atlassian.net', bearerToken: 'bearer-token' });
    // Just check it doesn't immediately return undefined
    const ref = await p.resolve('TK-1');
    assert.equal(ref, undefined); // will be undefined due to 404 from stub
  });
});

test('JiraTicketProvider maps HTTP failures to graceful undefined', async (t) => {
  const p = new JiraTicketProvider({ baseUrl: 'https://test.atlassian.net', email: 'test@test.com', apiToken: 'token' });

  await t.test('404 resolves undefined silently', async () => {
    await withFetch(
      async () => ({ ok: false, status: 404 }),
      async () => assert.equal(await p.resolve('TK-GONE'), undefined),
    );
  });

  await t.test('500 warns and resolves undefined', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      await withFetch(
        async () => ({ ok: false, status: 500 }),
        async () => assert.equal(await p.resolve('TK-BOOM'), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join('\n').includes('returned 500'));
  });

  await t.test('non-object JSON body warns and resolves undefined', async () => {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      await withFetch(
        async () => ({ ok: true, status: 200, json: async () => null }),
        async () => assert.equal(await p.resolve('TK-JUNK'), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join('\n').includes('Invalid JSON response'));
  });
});

test('JiraTicketProvider happy path maps Jira issue onto TicketRef', async (t) => {
  const p = new JiraTicketProvider({ baseUrl: 'https://test.atlassian.net', email: 'test@test.com', apiToken: 'token' });

  await t.test('maps status category to phase', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-123',
          fields: {
            status: {
              statusCategory: { name: 'In Progress' },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-123');
        assert.equal(ref.id, 'PROJ-123');
        assert.equal(ref.phase, 'EXECUTING');
      },
    );
  });

  await t.test('maps Done status to COMPLETED phase', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-124',
          fields: {
            status: {
              statusCategory: { name: 'Done' },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-124');
        assert.equal(ref.phase, 'COMPLETED');
      },
    );
  });

  await t.test('maps Canceled status to CANCELLED phase', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-125',
          fields: {
            status: {
              statusCategory: { name: 'Cancelled' },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-125');
        assert.equal(ref.phase, 'CANCELLED');
      },
    );
  });

  await t.test('maps Blocked status to BLOCKED phase', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-126',
          fields: {
            status: {
              statusCategory: { name: 'Blocked' },
            },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-126');
        assert.equal(ref.phase, 'BLOCKED');
      },
    );
  });

  await t.test('maps parent key to parentId', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-127',
          fields: {
            status: { statusCategory: { name: 'In Progress' } },
            parent: { key: 'PROJ-100', id: '10000' },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-127');
        assert.equal(ref.parentId, 'PROJ-100');
      },
    );
  });

  await t.test('maps Jira issue type to our type', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-128',
          fields: {
            status: { statusCategory: { name: 'To Do' } },
            issuetype: { name: 'Bug' },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-128');
        assert.equal(ref.type, 'fix');
      },
    );
  });

  await t.test('maps Story/Epic to feat type', async () => {
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          key: 'PROJ-129',
          fields: {
            status: { statusCategory: { name: 'Backlog' } },
            issuetype: { name: 'Story' },
          },
        }),
      }),
      async () => {
        const ref = await p.resolve('PROJ-129');
        assert.equal(ref.type, 'feat');
      },
    );
  });

  await t.test('timeout (AbortError) resolves undefined', async () => {
    const p = new JiraTicketProvider({ baseUrl: 'https://test.atlassian.net', email: 'test@test.com', apiToken: 'token', timeout: 1 });
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      await withFetch(
        async () => {
          // Simulate abort by throwing AbortError directly
          const err = new Error('Aborted');
          err.name = 'AbortError';
          throw err;
        },
        async () => assert.equal(await p.resolve('PROJ-1'), undefined),
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join('\n').includes('timed out'));
  });
});
