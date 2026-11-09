import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { createSkill } from '../dsh/sync.js';

function throwingWorkspace() {
  const ctx = {};
  Object.defineProperty(ctx, 'workspace', {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error('workspace service was not declared');
    },
  });
  return ctx;
}

describe('createSkill', { concurrency: false }, () => {
  test('rejects non-kebab names and empty descriptions', async () => {
    const home = await mkdtemp(join(tmpdir(), 'skill-sync-home-'));
    const previous = process.env.DSH_HOME;
    process.env.DSH_HOME = home;
    try {
      const ctx = throwingWorkspace();
      await assert.rejects(
        () => createSkill(ctx, { name: 'Not Kebab', description: 'has words', scope: 'personal' }),
        /kebab-case/,
      );
      await assert.rejects(
        () => createSkill(ctx, { name: 'my_skill', description: 'has words', scope: 'personal' }),
        /kebab-case/,
      );
      await assert.rejects(
        () => createSkill(ctx, { name: 'my-skill', description: '', scope: 'personal' }),
        /\u63cf\u8ff0/,
      );
      await assert.rejects(
        () => createSkill(ctx, { name: 'my-skill', description: '   ', scope: 'personal' }),
        /\u63cf\u8ff0/,
      );
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previous;
      await rm(home, { recursive: true, force: true });
    }
  });

  test('creates a personal skill when workspace access throws and rejects duplicates', async () => {
    const home = await mkdtemp(join(tmpdir(), 'skill-sync-home-'));
    const previous = process.env.DSH_HOME;
    process.env.DSH_HOME = home;
    try {
      const ctx = throwingWorkspace();
      const created = await createSkill(ctx, {
        name: 'my-skill',
        description: 'One line description',
        scope: 'personal',
      });
      assert.deepEqual(created, { name: 'my-skill', rootId: 'user-dsh', scope: 'personal' });
      const file = join(home, 'skills', 'my-skill', 'SKILL.md');
      const text = await readFile(file, 'utf8');
      assert.match(text, /^---\nname: my-skill\ndescription: "One line description"\n---\n/);
      await assert.rejects(
        () => createSkill(ctx, {
          name: 'my-skill',
          description: 'another description',
          scope: 'personal',
        }),
        /\u540c\u540d\u6280\u80fd\u5df2\u5b58\u5728/,
      );
      assert.equal(await readFile(file, 'utf8'), text);
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME;
      else process.env.DSH_HOME = previous;
      await rm(home, { recursive: true, force: true });
    }
  });
});
