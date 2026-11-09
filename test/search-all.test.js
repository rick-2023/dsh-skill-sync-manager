import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const start = source.indexOf('function originFlags');
const end = source.indexOf('function readStoredTab');
assert.ok(start >= 0 && end > start);
const context = {};
runInNewContext(`${source.slice(start, end)}\nthis.filterRows = filterRows;`, context);

test('search covers every origin and clearing restores the selected tab', () => {
  const rows = [
    { name: 'personal-skill', description: 'common', origin: '来源未知' },
    { name: 'codex-skill', description: 'common', origin: 'Codex' },
    { name: 'cursor-skill', description: 'common', origin: 'Cursor' },
  ];
  for (const tab of ['personal', 'codex', 'cursor']) {
    assert.equal(context.filterRows(rows, ' CoMmOn ', tab).length, 3);
    assert.equal(context.filterRows(rows, 'cursor-skill', tab)[0].name, 'cursor-skill');
    assert.equal(context.filterRows(rows, '  ', tab).length, 1);
  }
});
