import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SYNC_SOURCES } from '../dsh/sources.js';
import { scanSources } from '../dsh/vendor/scanner.js';

test('a Codex-like tree yields one candidate and ignores a directory without SKILL.md', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-sync-codex-'));
  try {
    const skills = join(dir, 'skills');
    const valid = join(skills, 'valid-skill');
    const empty = join(skills, 'notes-only');
    await mkdir(valid, { recursive: true });
    await mkdir(empty, { recursive: true });
    await writeFile(
      join(valid, 'SKILL.md'),
      '---\nname: valid-skill\ndescription: A real skill\n---\n\n# valid-skill\n',
      'utf8',
    );
    await writeFile(join(empty, 'README.txt'), 'no skill file here\n', 'utf8');

    const codex = SYNC_SOURCES.find((source) => source.id === 'codex');
    assert.ok(codex);
    const reports = await scanSources(
      [{
        ...codex,
        userDirs: [skills],
        projectDirs: [],
      }],
      [],
    );
    assert.equal(reports.length, 1);
    assert.equal(reports[0].candidates.length, 1);
    assert.equal(reports[0].candidates[0].name, 'valid-skill');
    assert.equal(reports[0].candidates[0].sourceId, 'codex');
    assert.equal(reports[0].candidates[0].path, valid);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
