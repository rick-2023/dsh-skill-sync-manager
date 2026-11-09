import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { readSkillMeta } from './vendor/frontmatter.js';
import { writableRoots, rootById } from './vendor/roots.js';

export const MAX_DETAIL_BYTES = 1024 * 1024;
export class DetailError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function workspaceList(ctx) {
  try {
    const ws = ctx?.workspace;
    if (typeof ws?.roots === 'function') return ws.roots().map(r => r.path).filter(Boolean);
    if (Array.isArray(ws?.list)) return ws.list.map(w => w.path).filter(Boolean);
  } catch {}
  return [];
}
async function checkedDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new DetailError(400, 'symbolic link or invalid directory');
  return stat;
}
async function readCandidate(rootPath, rootReal, entry, isDirectory) {
  const path = join(rootPath, entry);
  const directoryStat = isDirectory ? await checkedDirectory(path) : null;
  if (isDirectory && await realpath(path) !== join(rootReal, entry)) throw new DetailError(400, 'symbolic link or invalid directory');
  const file = isDirectory ? join(path, 'SKILL.md') : path;
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink()) throw new DetailError(400, 'symbolic link or invalid file');
  if (before.size > MAX_DETAIL_BYTES) throw new DetailError(413, 'skill file exceeds size limit');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino) throw new DetailError(400, 'skill file changed');
    if (stat.size > MAX_DETAIL_BYTES) throw new DetailError(413, 'skill file exceeds size limit');
    if (isDirectory) {
      const after = await checkedDirectory(path);
      if (after.dev !== directoryStat.dev || after.ino !== directoryStat.ino || await realpath(path) !== join(rootReal, entry)) throw new DetailError(400, 'skill directory changed');
    }
    if (await realpath(rootPath) !== rootReal) throw new DetailError(400, 'skill root changed');
    const buffer = Buffer.alloc(MAX_DETAIL_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > MAX_DETAIL_BYTES) throw new DetailError(413, 'skill file exceeds size limit');
    return buffer.subarray(0, length).toString('utf8');
  } finally { await handle.close(); }
}
export async function readDetail(ctx, input) {
  const { rootId, name } = input ?? {};
  if (typeof rootId !== 'string' || !rootId || typeof name !== 'string' || !name || name.length > 240 || /[\\/\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..') throw new DetailError(400, 'invalid skill identity');
  const root = rootById(writableRoots(workspaceList(ctx)), rootId);
  if (!root) throw new DetailError(404, 'unknown skill root');
  let entries, rootReal;
  try {
    await checkedDirectory(root.path);
    rootReal = await realpath(root.path);
    entries = await readdir(root.path, { withFileTypes: true });
  } catch (error) {
    if (error instanceof DetailError) throw error;
    if (error.code === 'ENOENT') throw new DetailError(404, 'skill not found');
    throw error;
  }
  const matches = [];
  let targetError;
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const directory = entry.isDirectory();
    const flat = entry.isFile() && entry.name.endsWith('.md');
    if (!directory && !flat) {
      if (entry.isSymbolicLink() && (entry.name === name || entry.name === `${name}.md`)) targetError = new DetailError(400, 'symbolic links are not supported');
      continue;
    }
    try {
      const content = await readCandidate(root.path, rootReal, entry.name, directory);
      const meta = readSkillMeta(content);
      if (!directory && meta === null) continue;
      const candidateName = meta?.name ?? (directory ? entry.name : entry.name.slice(0, -3));
      if (candidateName === name) matches.push(content);
    } catch (error) {
      if ((entry.name === name || entry.name === `${name}.md`) && error.code !== 'ENOENT') targetError = error;
    }
  }
  if (targetError) {
    if (targetError instanceof DetailError) throw targetError;
    if (targetError.code === 'ELOOP') throw new DetailError(400, 'symbolic links are not supported');
    throw targetError;
  }
  if (matches.length > 1) throw new DetailError(409, 'skill name is ambiguous');
  if (!matches.length) throw new DetailError(404, 'skill not found');
  return { content: matches[0] };
}
