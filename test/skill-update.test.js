import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { importItems } from '../dsh/vendor/importer.js';
import { readSkillMeta } from '../dsh/vendor/frontmatter.js';
import { assertContained, assertSafeRelative } from '../dsh/vendor/roots.js';
import { scanSources } from '../dsh/vendor/scanner.js';
import { SYNC_SOURCES } from '../dsh/sources.js';

function skillFile(name, description, body = `# ${name}\n`) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
}

async function writeSkill(parent, folder, text, extra) {
  const dir = join(parent, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), text, 'utf8');
  if (extra !== undefined) await writeFile(join(dir, 'notes.txt'), extra, 'utf8');
  return dir;
}

test('updating an existing name with conflict skip keeps local edits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-update-'));
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-update-src-'));
  const root = { id: 'user-dsh', path: dir, writable: true };
  try {
    const local = skillFile('demo-skill', 'local description', 'local body\n');
    await writeSkill(dir, 'demo-skill', local, 'local-note');
    const source = await writeSkill(
      sourceParent,
      'demo-skill',
      skillFile('demo-skill', 'upstream description', 'upstream body\n'),
      'upstream-note',
    );
    const before = await readdir(dir);
    const outcomes = await importItems(
      root,
      [{ sourcePath: source }],
      'skip',
      async () => {
        throw new Error('moveToTrash should not run for a skipped update');
      },
    );
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].status, 'skipped');
    assert.equal(outcomes[0].name, 'demo-skill');
    assert.equal(outcomes[0].targetPath, undefined);
    assert.equal(await readFile(join(dir, 'demo-skill', 'SKILL.md'), 'utf8'), local);
    assert.equal(await readFile(join(dir, 'demo-skill', 'notes.txt'), 'utf8'), 'local-note');
    assert.deepEqual((await readdir(dir)).sort(), before.sort());
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});

test('same name from two sources stays one installed skill and a distinct name is separate', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-update-'));
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-update-src-'));
  const root = { id: 'user-dsh', path: dir, writable: true };
  try {
    const codexRoot = join(sourceParent, 'codex');
    const cursorRoot = join(sourceParent, 'cursor');
    const sharedCodex = await writeSkill(codexRoot, 'shared-skill', skillFile('shared-skill', 'codex copy'));
    const sharedCursor = await writeSkill(cursorRoot, 'shared-skill', skillFile('shared-skill', 'cursor copy'));
    const other = await writeSkill(codexRoot, 'other-skill', skillFile('other-skill', 'other copy'));

    const first = await importItems(root, [{ sourcePath: sharedCodex }], 'skip', async () => {
      throw new Error('trash');
    });
    assert.equal(first[0].status, 'imported');
    const second = await importItems(
      root,
      [{ sourcePath: sharedCursor }, { sourcePath: other }],
      'skip',
      async () => {
        throw new Error('trash');
      },
    );
    assert.equal(second[0].status, 'skipped');
    assert.equal(second[0].name, 'shared-skill');
    assert.equal(second[1].status, 'imported');
    assert.equal(second[1].name, 'other-skill');
    assert.equal(
      await readFile(join(dir, 'shared-skill', 'SKILL.md'), 'utf8'),
      skillFile('shared-skill', 'codex copy'),
    );
    assert.equal(readSkillMeta(await readFile(join(dir, 'other-skill', 'SKILL.md'), 'utf8'))?.name, 'other-skill');
    assert.deepEqual((await readdir(dir)).sort(), ['other-skill', 'shared-skill']);

    const codex = SYNC_SOURCES.find((source) => source.id === 'codex');
    const cursor = SYNC_SOURCES.find((source) => source.id === 'cursor');
    const reports = await scanSources(
      [
        { ...codex, userDirs: [codexRoot], projectDirs: [] },
        { ...cursor, userDirs: [cursorRoot], projectDirs: [] },
      ],
      [{ name: 'shared-skill' }, { name: 'other-skill' }],
    );
    const shared = reports.flatMap((report) => report.candidates.filter((candidate) => candidate.name === 'shared-skill'));
    assert.equal(shared.length, 2);
    assert.deepEqual(shared.map((candidate) => candidate.sourceId), ['codex', 'cursor']);
    assert.ok(shared.every((candidate) => candidate.conflict === true));
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});

test('unsafe skill paths are rejected and the root is not written', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-update-'));
  const outside = await mkdtemp(join(tmpdir(), 'skill-sync-update-out-'));
  const root = { id: 'user-dsh', path: dir, writable: true };
  try {
    await writeFile(join(dir, 'keep.txt'), 'sentinel', 'utf8');
    await writeFile(join(outside, 'keep.txt'), 'outside', 'utf8');
    const escapes = [
      join(dir, '..', 'escape'),
      join(outside, 'skill'),
      resolve('/tmp/skill-sync-not-our-root'),
    ];
    for (const target of escapes) {
      assert.throws(() => assertContained(root, target), /escapes root/);
    }
    assert.throws(() => assertContained(root, 'skills/demo'), /not absolute/);
    for (const rel of ['../SKILL.md', '/etc/passwd', 'foo/../../SKILL.md', 'foo\\bar', 'foo/CON', 'a/..']) {
      assert.throws(() => assertSafeRelative(rel), /unsafe/);
    }
    assert.equal(assertSafeRelative('assets/notes.txt'), 'assets/notes.txt');
    assert.equal(await readFile(join(dir, 'keep.txt'), 'utf8'), 'sentinel');
    assert.equal(await readFile(join(outside, 'keep.txt'), 'utf8'), 'outside');
    assert.deepEqual(await readdir(dir), ['keep.txt']);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
