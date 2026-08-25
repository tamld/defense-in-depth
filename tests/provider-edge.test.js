// Executor: Sisyphus (OhMyOpenCode)
// [PROVEN] provider fallback contracts per plans/coverage-95/SRS.md FR-3.1–FR-3.2.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileTicketProvider } from '../dist/federation/file-provider.js';
import { HttpTicketProvider } from '../dist/federation/http-provider.js';

async function makeRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

const TICKET_MD = [
  '---',
  'id: TK-42',
  'phase: EXECUTING',
  'type: fix',
  'parentId: TK-PARENT',
  '---',
  '',
  '# Ticket body',
].join('\n');

test('FileTicketProvider degrades silently on missing/unparseable tickets', async (t) => {
  await t.test('missing ticket file resolves undefined without throwing', async () => {
    const root = await makeRoot('did-fileprov-missing-');
    try {
      const p = new FileTicketProvider({ projectRoot: root });
      assert.equal(await p.resolve('TK-42'), undefined);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('content without frontmatter resolves undefined', async () => {
    const root = await makeRoot('did-fileprov-nofm-');
    try {
      await writeFile(path.join(root, 'TICKET.md'), 'plain prose, no frontmatter\n', 'utf8');
      const p = new FileTicketProvider({ projectRoot: root });
      assert.equal(await p.resolve('TK-42'), undefined);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('valid frontmatter enriches ref and drops invalid type values', async () => {
    const root = await makeRoot('did-fileprov-valid-');
    try {
      await writeFile(path.join(root, 'TICKET.md'), TICKET_MD, 'utf8');
      const p = new FileTicketProvider({ projectRoot: root });
      const ref = await p.resolve('TK-42');
      assert.equal(ref.id, 'TK-42');
      assert.equal(ref.phase, 'EXECUTING');
      assert.equal(ref.type, 'fix');
      assert.equal(ref.parentId, 'TK-PARENT');

      await writeFile(
        path.join(root, 'TICKET.md'),
        TICKET_MD.replace('type: fix', 'type: bogus-kind'),
        'utf8',
      );
      const ref2 = await p.resolve('TK-42');
      assert.equal(ref2.type, undefined, 'invalid enum value must be dropped');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('HttpTicketProvider maps HTTP failures to graceful undefined', async (t) => {
  async function withFetch(stub, fn) {
    const orig = globalThis.fetch;
    globalThis.fetch = stub;
    try {
      return await fn();
    } finally {
      globalThis.fetch = orig;
    }
  }

  await t.test('404 resolves undefined silently', async () => {
    const p = new HttpTicketProvider({ endpoint: 'http://stub/api/tickets' });
    await withFetch(async () => ({ ok: false, status: 404 }), async () => {
      assert.equal(await p.resolve('TK-GONE'), undefined);
    });
  });

  await t.test('500 warns and resolves undefined', async () => {
    const p = new HttpTicketProvider({ endpoint: 'http://stub/api/tickets' });
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      await withFetch(async () => ({ ok: false, status: 500 }), async () => {
        assert.equal(await p.resolve('TK-BOOM'), undefined);
      });
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join('\n').includes('returned 500'));
  });

  await t.test('non-object JSON body warns and resolves undefined', async () => {
    const p = new HttpTicketProvider({ endpoint: 'http://stub/api/tickets' });
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...a) => warnings.push(a.join(' '));
    try {
      await withFetch(
        async () => ({ ok: true, status: 200, json: async () => null }),
        async () => {
          assert.equal(await p.resolve('TK-JUNK'), undefined);
        },
      );
    } finally {
      console.warn = origWarn;
    }
    assert.ok(warnings.join('\n').includes('Invalid JSON response'));
  });

  await t.test('happy path maps payload onto TicketRef', async () => {
    const p = new HttpTicketProvider({ endpoint: 'http://stub/api/tickets' });
    await withFetch(
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: 'TK-9', phase: 'DONE', type: 'chore', parentId: 'TK-P' }),
      }),
      async () => {
        const ref = await p.resolve('TK-9');
        assert.equal(ref.id, 'TK-9');
        assert.equal(ref.phase, 'DONE');
        assert.equal(ref.type, 'chore');
        assert.equal(ref.parentId, 'TK-P');
      },
    );
  });
});
