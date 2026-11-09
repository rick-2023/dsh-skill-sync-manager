import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { SYNC_SOURCES } from '../dsh/sources.js';
import { scanSources } from '../dsh/vendor/scanner.js';

function rowsFromOverview() {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const start = source.indexOf('function scopeOf');
  const end = source.indexOf('function IconButton');
  assert.ok(start >= 0 && end > start, 'rowsFromOverview is no longer in lib/client.js');
  const sandbox = {};
  runInNewContext(`${source.slice(start, end)}\nthis.rowsFromOverview = rowsFromOverview;`, sandbox);
  return sandbox.rowsFromOverview;
}

function skillMarkdown(name, description) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
}

async function writeSkill(root, name, description) {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), skillMarkdown(name, description), 'utf8');
  return dir;
}

test('Codex and Cursor copies of the same name keep both labels', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-origins-'));
  try {
    const codexRoot = join(dir, 'codex');
    const cursorRoot = join(dir, 'cursor');
    await writeSkill(codexRoot, 'shared-skill', 'from codex');
    await writeSkill(cursorRoot, 'shared-skill', 'from cursor');
    const codex = SYNC_SOURCES.find((source) => source.id === 'codex');
    const cursor = SYNC_SOURCES.find((source) => source.id === 'cursor');
    assert.equal(codex?.label, 'Codex');
    assert.equal(cursor?.label, 'Cursor');

    const reports = await scanSources(
      [
        { ...codex, userDirs: [codexRoot], projectDirs: [] },
        { ...cursor, userDirs: [cursorRoot], projectDirs: [] },
      ],
      [{ name: 'shared-skill' }],
    );
    assert.deepEqual(
      reports.map((report) => report.candidates.map((candidate) => ({
        name: candidate.name,
        sourceId: candidate.sourceId,
        sourceLabel: candidate.sourceLabel,
        conflict: candidate.conflict,
      }))),
      [
        [{ name: 'shared-skill', sourceId: 'codex', sourceLabel: 'Codex', conflict: true }],
        [{ name: 'shared-skill', sourceId: 'cursor', sourceLabel: 'Cursor', conflict: true }],
      ],
    );

    const [row] = rowsFromOverview()({
      scan: { reports },
      skills: {
        groups: [{
          rootId: 'user-dsh',
          skills: [{ name: 'shared-skill', meta: { description: 'installed copy', modelInvocable: true } }],
        }],
      },
    });
    assert.equal(row.origin, 'Codex / Cursor');
    assert.notEqual(row.origin, '\u81ea\u5efa');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a skill missing from every scan is \u6765\u6e90\u672a\u77e5, not \u81ea\u5efa', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-origins-'));
  try {
    const known = join(dir, 'codex');
    const unlabeled = join(dir, 'vault');
    await writeSkill(known, 'synced-skill', 'known source');
    await writeSkill(unlabeled, 'foreign-skill', 'id only');
    const codex = SYNC_SOURCES.find((source) => source.id === 'codex');
    const reports = await scanSources(
      [
        { ...codex, userDirs: [known], projectDirs: [] },
        { id: 'vault', label: '', userDirs: [unlabeled], projectDirs: [] },
      ],
      [],
    );
    const rows = rowsFromOverview()({
      scan: { reports },
      skills: {
        groups: [{
          rootId: 'user-dsh',
          skills: [
            { name: 'synced-skill', meta: { description: 'known', modelInvocable: true } },
            { name: 'foreign-skill', meta: { description: 'unknown source id', modelInvocable: true } },
            { name: 'handmade-skill', meta: { description: 'no scan candidate', modelInvocable: true } },
          ],
        }],
      },
    });
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.origin]));
    assert.equal(byName['synced-skill'], 'Codex');
    assert.equal(byName['foreign-skill'], 'vault');
    assert.equal(byName['handmade-skill'], '\u6765\u6e90\u672a\u77e5');
    for (const origin of Object.values(byName)) assert.notEqual(origin, '\u81ea\u5efa');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
