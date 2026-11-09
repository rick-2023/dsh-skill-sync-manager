import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { readSkillMeta, repairFrontmatter, setFlag, splitFrontmatter } from '../dsh/vendor/frontmatter.js';

const BASE = [
  '---',
  'name: keep-name',
  'description: Keep this description',
  '---',
  '',
  '# keep-name',
  '',
].join('\n');

const DISABLED = [
  '---',
  'name: keep-name',
  'description: Keep this description',
  'disable-model-invocation: true',
  '---',
  '',
  '# keep-name',
  '',
].join('\n');

test('readSkillMeta honors disable-model-invocation', () => {
  assert.equal(readSkillMeta(BASE)?.modelInvocable, true);
  assert.equal(readSkillMeta(DISABLED)?.modelInvocable, false);
  const explicitOff = BASE.replace(
    'description: Keep this description',
    'description: Keep this description\ndisable-model-invocation: false',
  );
  assert.equal(readSkillMeta(explicitOff)?.modelInvocable, true);
});

test('setFlag toggles disable-model-invocation without dropping name or description', () => {
  const disabled = setFlag(BASE, 'disable-model-invocation', true);
  const disabledMeta = readSkillMeta(disabled);
  assert.equal(disabledMeta?.name, 'keep-name');
  assert.equal(disabledMeta?.description, 'Keep this description');
  assert.equal(disabledMeta?.modelInvocable, false);
  assert.match(disabled, /name: keep-name/);
  assert.match(disabled, /description: Keep this description/);
  assert.match(disabled, /disable-model-invocation: true/);
  assert.match(disabled, /# keep-name/);

  const enabled = setFlag(disabled, 'disable-model-invocation', false);
  const enabledMeta = readSkillMeta(enabled);
  assert.equal(enabledMeta?.name, 'keep-name');
  assert.equal(enabledMeta?.description, 'Keep this description');
  assert.equal(enabledMeta?.modelInvocable, true);
  assert.doesNotMatch(enabled, /disable-model-invocation/);
  assert.match(enabled, /name: keep-name/);
  assert.match(enabled, /description: Keep this description/);
});

test('repairFrontmatter makes a description containing a colon parseable', () => {
  const raw = [
    '---',
    'name: colon-skill',
    'description: Use when: planning tasks',
    '---',
    '',
    '# colon-skill',
    '',
  ].join('\n');
  assert.equal(splitFrontmatter(raw), null);
  const repaired = repairFrontmatter(raw);
  assert.equal(typeof repaired, 'string');
  const split = splitFrontmatter(repaired);
  assert.notEqual(split, null);
  const header = repaired.split('\n').slice(1, repaired.split('\n').indexOf('---', 1)).join('\n');
  const parsed = parseYaml(header);
  assert.equal(parsed.name, 'colon-skill');
  assert.equal(parsed.description, 'Use when: planning tasks');
  assert.equal(readSkillMeta(repaired)?.description, 'Use when: planning tasks');
});
