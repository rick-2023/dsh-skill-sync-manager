import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSync } from '../dsh/sync.js';
import { checkUpdate, applyUpdate, writeLedger } from '../dsh/update.js';

const skill = (name, body) => `---\nname: ${name}\ndescription: example\n---\n${body}\n`;
test('verified imports update explicitly while protecting local edits and invocation state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-update-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = join(dir, 'home');
  try {
    const name = 'update-backend-fixture-unique';
    const source = join(dir, '.codex', 'skills', name);
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'SKILL.md'), skill(name, 'original'));
    await writeFile(join(source, 'extra.txt'), 'original extra');
    const ctx = { workspace: { roots: () => [{ path: dir }] } };
    const input = { rootId: 'user-dsh', name };
    await runSync(ctx, { targetRootId: 'user-dsh', enabledSourceIds: ['codex'] });
    const target = join(process.env.DSH_HOME, 'skills', name);
    assert.equal((await checkUpdate(ctx, input)).status, 'up_to_date');
    await writeFile(join(target, 'SKILL.md'), skill(name, 'original').replace('description: example', 'description: example\ndisable-model-invocation: true'));
    await writeFile(join(source, 'SKILL.md'), skill(name, 'new version'));
    const check = await checkUpdate(ctx, input);
    assert.equal(check.status, 'update_available');
    await writeFile(join(source, 'extra.txt'), 'changed after check');
    assert.equal((await applyUpdate(ctx, { ...input, token: check.token })).status, 'blocked');
    const fresh = await checkUpdate(ctx, input);
    assert.equal(fresh.status, 'update_available');
    assert.equal((await applyUpdate(ctx, { ...input, token: fresh.token })).status, 'updated');
    assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /disable-model-invocation: true/);
    assert.match(await readFile(join(target, 'SKILL.md'), 'utf8'), /new version/);
    assert.equal((await applyUpdate(ctx, { ...input, token: check.token })).status, 'blocked');
    await writeFile(join(target, 'extra.txt'), 'local change');
    await writeFile(join(source, 'extra.txt'), 'upstream change');
    assert.equal((await checkUpdate(ctx, input)).status, 'blocked');
    assert.equal(await readFile(join(target, 'extra.txt'), 'utf8'), 'local change');
    assert.equal((await checkUpdate(ctx, { ...input, name: '../escape' })).status, 'blocked');
    await writeFile(join(target, 'extra.txt'), 'changed after check');
    const warningCheck = await checkUpdate(ctx, input);
    assert.equal(warningCheck.status, 'update_available');
    const ledgerFile = join(process.env.DSH_HOME, 'skill-sync', 'origins.json');
    const savedLedger = await readFile(ledgerFile, 'utf8');
    await rm(ledgerFile);
    await mkdir(ledgerFile);
    // A destination directory forces the atomic ledger rename to fail.
    await assert.rejects(writeLedger({ example: true }));
    await rm(ledgerFile, { recursive: true });
    await writeFile(ledgerFile, savedLedger);
    assert.equal((await applyUpdate(ctx, { ...input, token: warningCheck.token })).status, 'updated');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
