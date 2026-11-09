import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../dsh/index.js';
import { MAX_DETAIL_BYTES } from '../dsh/detail.js';

const doc = (name, body) => `---\nname: ${name}\ndescription: example\n---\n${body}\n`;

test('detail API reads only the selected root and rejects unsafe inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-detail-'));
  const oldHome = process.env.DSH_HOME;
  process.env.DSH_HOME = join(dir, 'home');
  try {
    const root = join(process.env.DSH_HOME, 'skills');
    const project = join(dir, 'project');
    const projectRoot = join(project, '.dsh', 'skills');
    await mkdir(join(root, 'folder'), { recursive: true });
    await mkdir(join(projectRoot, 'folder'), { recursive: true });
    await writeFile(join(root, 'folder', 'SKILL.md'), doc('alias', 'global'));
    await writeFile(join(projectRoot, 'folder', 'SKILL.md'), doc('alias', 'project'));
    await writeFile(join(root, 'flat.md'), doc('flat', 'file'));
    let handler;
    const ctx = { workspace: { roots: () => [{ path: project }] }, effect: fn => fn(), inject: () => {}, connection: { fetch: { register: route => { handler = route.fetch; } } } };
    apply(ctx, { autoSyncOnBoot: false, intervalMs: 0 });
    const call = async (body, raw = false) => {
      const response = await handler(new Request('http://localhost/api/skill-sync?action=detail', { method: 'POST', body: raw ? body : JSON.stringify(body) }));
      return [response.status, await response.json()];
    };
    assert.deepEqual(await call({ rootId: 'user-dsh', name: 'alias' }), [200, { content: doc('alias', 'global') }]);
    assert.deepEqual(await call({ rootId: `project-dsh:${project}`, name: 'alias' }), [200, { content: doc('alias', 'project') }]);
    assert.deepEqual(await call({ rootId: 'user-dsh', name: 'flat' }), [200, { content: doc('flat', 'file') }]);
    assert.equal((await call('{', true))[0], 400);
    assert.equal((await call(null))[0], 400);
    assert.equal((await call({ rootId: 'user-dsh', name: '../flat' }))[0], 400);
    assert.equal((await call({ rootId: 'unknown', name: 'flat' }))[0], 404);
    assert.equal((await call({ rootId: 'user-dsh', name: 'missing' }))[0], 404);
    await mkdir(join(root, 'linked'));
    await symlink(join(root, 'flat.md'), join(root, 'linked', 'SKILL.md'));
    assert.equal((await call({ rootId: 'user-dsh', name: 'linked' }))[0], 400);
    await symlink(join(root, 'folder'), join(root, 'linkdir'));
    assert.equal((await call({ rootId: 'user-dsh', name: 'linkdir' }))[0], 400);
    await mkdir(join(root, 'large'));
    await writeFile(join(root, 'large', 'SKILL.md'), 'x'.repeat(MAX_DETAIL_BYTES + 1));
    assert.equal((await call({ rootId: 'user-dsh', name: 'large' }))[0], 413);
    await writeFile(join(root, 'duplicate.md'), doc('alias', 'duplicate'));
    assert.equal((await call({ rootId: 'user-dsh', name: 'alias' }))[0], 409);
  } finally {
    if (oldHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = oldHome;
    await rm(dir, { recursive: true, force: true });
  }
});
