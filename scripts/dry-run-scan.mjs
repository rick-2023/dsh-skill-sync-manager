#!/usr/bin/env node
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SYNC_SOURCES } from '../dsh/sources.js';
import { scanSources } from '../dsh/vendor/scanner.js';
import { enumerateRoot, writableRoots } from '../dsh/vendor/roots.js';

const dirs = [
  join(homedir(), '.codex', 'skills'),
  join(homedir(), '.cursor', 'skills'),
  join(homedir(), '.cursor', 'skills-cursor'),
];

for (const d of dirs) {
  console.log(existsSync(d) ? `OK  ${d}` : `MISS ${d}`);
}

const roots = writableRoots([]);
const installed = [];
for (const root of roots) {
  installed.push(...(await enumerateRoot(root)));
}

const reports = await scanSources(SYNC_SOURCES, installed, process.cwd());
for (const r of reports) {
  const cands = r.candidates?.length ?? 0;
  const conflicts = r.candidates?.filter((c) => c.conflict).length ?? 0;
  const fresh = cands - conflicts;
  console.log(`${r.source.id}: ${cands} candidates (${fresh} importable, ${conflicts} conflicts)`);
}
