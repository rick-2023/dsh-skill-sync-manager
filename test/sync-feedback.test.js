import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanSources } from '../dsh/vendor/scanner.js';
import { runSync } from '../dsh/sync.js';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'sync-feedback-'));
  const oldHome = process.env.HOME;
  const oldDshHome = process.env.DSH_HOME;
  process.env.HOME = join(dir, 'home');
  process.env.DSH_HOME = join(dir, 'dsh');
  await mkdir(process.env.HOME, { recursive: true });
  t.after(async () => {
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    if (oldDshHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = oldDshHome;
    await rm(dir, { recursive: true, force: true });
  });
  return dir;
}
async function skill(base, folder, name) {
  const path = join(base, folder);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'SKILL.md'), `---\nname: ${name}\ndescription: test\n---\n`);
}

test('sync reports imports, duplicate names and invalid names accurately', async t => {
  const dir = await fixture(t);
  const codex = join(dir, 'home', '.codex', 'skills');
  const cursor = join(dir, 'home', '.cursor', 'skills');
  await skill(codex, 'one', 'shared-test');
  await skill(cursor, 'two', 'shared-test');
  await skill(codex, 'invalid', 'Bad Name');
  const state = await runSync({}, { targetRootId: 'user-dsh' });
  assert.deepEqual(state.totals, { imported: 1, skipped: 1, failed: 1 });
  assert.equal(state.perSource.codex.failed, 1);
  assert.equal(state.details.find(x => x.name === 'Bad Name').reason, 'import_failed');
  assert.equal(state.details.find(x => x.sourceId === 'cursor').reason, 'already_exists');
  assert.equal(state.detailTotal, 3);
  assert.equal(state.detailsTruncated, false);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'dsh', 'skill-sync', 'state.json'), 'utf8')), state);
});

test('scanner distinguishes missing paths from other errors', async t => {
  const dir = await fixture(t);
  const nonDirectory = join(dir, 'file');
  await writeFile(nonDirectory, 'x');
  const source = { id: 'test', label: 'test', userDirs: [join(dir, 'missing'), nonDirectory], projectDirs: [] };
  const [report] = await scanSources([source], []);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].code, 'ENOTDIR');
  assert.equal(report.issues[0].path, nonDirectory);
});

test('origin record failure warns while keeping the successful import', async t => {
  const dir = await fixture(t);
  await skill(join(dir, 'home', '.codex', 'skills'), 'one', 'warning-test');
  await mkdir(join(dir, 'dsh', 'skill-sync', 'origins.json'), { recursive: true });
  const state = await runSync({}, { targetRootId: 'user-dsh', enabledSourceIds: ['codex'] });
  assert.equal(state.totals.imported, 1);
  assert.equal(state.totals.failed, 0);
  assert.equal(state.warnings[0].reason, 'origin_record_failed');
  assert.equal(state.warnings[0].name, 'warning-test');
});

test('details are bounded without truncating counts', async t => {
  const dir = await fixture(t);
  const source = join(dir, 'home', '.codex', 'skills');
  const target = join(dir, 'dsh', 'skills');
  for (let i = 0; i < 205; i++) {
    const name = `bounded-${i}`;
    await skill(source, name, name);
    await skill(target, name, name);
  }
  const state = await runSync({}, { targetRootId: 'user-dsh', enabledSourceIds: ['codex'] });
  assert.equal(state.totals.skipped, 205);
  assert.equal(state.details.length, 200);
  assert.equal(state.detailTotal, 205);
  assert.equal(state.detailsTruncated, true);
});
