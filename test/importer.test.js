import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { importItems } from '../dsh/vendor/importer.js';
import { readSkillMeta } from '../dsh/vendor/frontmatter.js';

function skillFile(name, description, body = `# ${name}\n`) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`;
}

async function makeRoot() {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-import-'));
  return { dir, root: { id: 'test-root', path: dir, writable: true } };
}

async function writeSkill(parent, folder, text, extra) {
  const dir = join(parent, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'SKILL.md'), text, 'utf8');
  if (extra !== undefined) await writeFile(join(dir, 'notes.txt'), extra, 'utf8');
  return dir;
}

async function listing(dir) {
  return (await readdir(dir)).sort();
}

test('importItems copies a valid SKILL.md into the root', async () => {
  const { dir, root } = await makeRoot();
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-src-'));
  try {
    const text = skillFile('demo-skill', 'Copies a real skill file');
    const source = await writeSkill(sourceParent, 'demo-skill', text, 'keep-me');
    const outcomes = await importItems(
      root,
      [{ sourcePath: source }],
      'skip',
      async () => {
        throw new Error('moveToTrash should not run');
      },
    );
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].status, 'imported');
    assert.equal(outcomes[0].name, 'demo-skill');
    const copied = await readFile(join(dir, 'demo-skill', 'SKILL.md'), 'utf8');
    assert.equal(copied, text);
    assert.equal(await readFile(join(dir, 'demo-skill', 'notes.txt'), 'utf8'), 'keep-me');
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});

test('importItems skip does not overwrite an existing same name', async () => {
  const { dir, root } = await makeRoot();
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-src-'));
  try {
    const original = skillFile('demo-skill', 'original description', 'original body\n');
    await writeSkill(dir, 'demo-skill', original, 'original-note');
    const source = await writeSkill(
      sourceParent,
      'incoming',
      skillFile('demo-skill', 'replacement description', 'replacement body\n'),
      'replacement-note',
    );
    const outcomes = await importItems(
      root,
      [{ sourcePath: source }],
      'skip',
      async () => {
        throw new Error('moveToTrash should not run');
      },
    );
    assert.equal(outcomes[0].status, 'skipped');
    assert.equal(outcomes[0].name, 'demo-skill');
    assert.equal(await readFile(join(dir, 'demo-skill', 'SKILL.md'), 'utf8'), original);
    assert.equal(await readFile(join(dir, 'demo-skill', 'notes.txt'), 'utf8'), 'original-note');
    assert.deepEqual(await listing(dir), ['demo-skill']);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});

test('importItems skips an invalid name and leaves the root untouched', async () => {
  const { dir, root } = await makeRoot();
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-src-'));
  try {
    await writeFile(join(dir, 'keep.txt'), 'sentinel', 'utf8');
    const before = await listing(dir);
    const source = await writeSkill(
      sourceParent,
      'Not Valid',
      skillFile('Not Valid', 'bad name'),
    );
    const outcomes = await importItems(
      root,
      [{ sourcePath: source }],
      'skip',
      async () => {
        throw new Error('moveToTrash should not run');
      },
    );
    assert.equal(outcomes[0].status, 'skipped');
    assert.match(outcomes[0].error ?? '', /invalid skill name/);
    assert.deepEqual(await listing(dir), before);
    assert.equal(await readFile(join(dir, 'keep.txt'), 'utf8'), 'sentinel');
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});

test('importItems rename writes a unique folder and matching frontmatter name', async () => {
  const { dir, root } = await makeRoot();
  const sourceParent = await mkdtemp(join(tmpdir(), 'skill-sync-src-'));
  try {
    await writeSkill(dir, 'demo-skill', skillFile('demo-skill', 'already installed'));
    const source = await writeSkill(
      sourceParent,
      'demo-skill',
      skillFile('demo-skill', 'renamed copy'),
    );
    const outcomes = await importItems(
      root,
      [{ sourcePath: source }],
      'rename',
      async () => {
        throw new Error('moveToTrash should not run');
      },
    );
    assert.equal(outcomes[0].status, 'renamed');
    assert.equal(outcomes[0].name, 'demo-skill-2');
    const renamedDir = join(dir, 'demo-skill-2');
    const text = await readFile(join(renamedDir, 'SKILL.md'), 'utf8');
    assert.equal(readSkillMeta(text)?.name, 'demo-skill-2');
    assert.equal(await readFile(join(dir, 'demo-skill', 'SKILL.md'), 'utf8'), skillFile('demo-skill', 'already installed'));
    assert.deepEqual(await listing(dir), ['demo-skill', 'demo-skill-2']);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(sourceParent, { recursive: true, force: true });
  }
});
