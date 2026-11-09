import assert from 'node:assert/strict';
import test from 'node:test';

function originFlags(origin) {
  if (origin === '来源未知') return { personal: true, codex: false, cursor: false };
  const parts = String(origin).split(' / ').map((part) => part.trim()).filter(Boolean);
  return {
    personal: false,
    codex: parts.some((part) => part === 'Codex'),
    cursor: parts.some((part) => part === 'Cursor'),
  };
}

function rowMatchesTab(row, tabId) {
  const flags = originFlags(row.origin);
  if (tabId === 'personal') return flags.personal;
  if (tabId === 'codex') return flags.codex;
  if (tabId === 'cursor') return flags.cursor;
  return true;
}

test('tabs classify by scan origin labels', () => {
  assert.equal(rowMatchesTab({ origin: '来源未知' }, 'personal'), true);
  assert.equal(rowMatchesTab({ origin: '来源未知' }, 'codex'), false);
  assert.equal(rowMatchesTab({ origin: 'Codex' }, 'codex'), true);
  assert.equal(rowMatchesTab({ origin: 'Codex' }, 'personal'), false);
  assert.equal(rowMatchesTab({ origin: 'Cursor' }, 'cursor'), true);
  assert.equal(rowMatchesTab({ origin: 'Codex / Cursor' }, 'codex'), true);
  assert.equal(rowMatchesTab({ origin: 'Codex / Cursor' }, 'cursor'), true);
  assert.equal(rowMatchesTab({ origin: 'Codex / Cursor' }, 'personal'), false);
});
