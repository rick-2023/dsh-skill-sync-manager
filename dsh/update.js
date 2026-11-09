import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { copyTree, isSkillName } from './vendor/importer.js';
import { readSkillMeta, setFlag } from './vendor/frontmatter.js';
import { enumerateRoot, rootById, writableRoots, dshHome } from './vendor/roots.js';
import { scanSources } from './vendor/scanner.js';
import { SYNC_SOURCES } from './sources.js';

const checks = new Map();
const messages = {
  'Invalid skill identity': '技能名称或目录无效',
  'Unknown skill root': '未知技能目录',
  'Skill root is not a real directory': '技能目录不是实际目录',
  'Installed skill is missing or ambiguous': '已安装技能不存在或存在重名',
  'No trusted import origin and baseline': '缺少可信的导入来源和基线，无法安全更新',
  'Source is missing or ambiguous': '来源不存在或存在多个同名来源',
  'Installed skill has local modifications': '技能含有本地修改，已停止更新',
  'Installed skill metadata is invalid': '已安装技能元数据无效',
  'Invalid or expired update token': '更新凭证无效或已过期，请重新检查',
  'Skill or source changed since check': '技能或来源在检查后发生变化，请重新检查',
  'Skill or source changed during update': '技能或来源在更新过程中发生变化',
};
const blocked = message => ({ status: 'blocked', message: messages[message] ?? `无法安全更新：${message}` });
const ledgerPath = () => join(dshHome(), 'skill-sync', 'origins.json');
async function ledger() { try { return JSON.parse(await readFile(ledgerPath(), 'utf8')); } catch { return {}; } }
export async function writeLedger(records) {
  const path = ledgerPath();
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(records, null, 2), { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
function key(rootId, name) { return JSON.stringify([rootId, name]); }
async function digestTree(path, normalizeFlag = false) {
  const hash = createHash('sha256');
  let size = 0;
  async function walk(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('symbolic links are not supported');
      if (entry.isDirectory()) { hash.update(`d:${JSON.stringify(rel)}\n`); await walk(full, rel); }
      else if (entry.isFile()) {
        let bytes = await readFile(full);
        size += bytes.length;
        if (size > 256 * 1024 * 1024) throw new Error('skill exceeds size limit');
        if (normalizeFlag && rel === 'SKILL.md') bytes = Buffer.from(setFlag(bytes.toString('utf8'), 'disable-model-invocation', false));
        hash.update(`f:${JSON.stringify(rel)}:${bytes.length}:`); hash.update(bytes);
      } else throw new Error('special files are not supported');
    }
  }
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('skill is not a real directory');
  await walk(path);
  return hash.digest('hex');
}
export async function recordOrigin(root, name, sourceId, sourcePath, sourceBefore) {
  const sourceAfter = await digestTree(sourcePath);
  if (sourceBefore !== sourceAfter) return;
  const installed = await digestTree(join(root.path, name), true);
  const records = await ledger();
  records[key(root.id, name)] = { sourceId, sourcePath, sourceHash: sourceAfter, installedHash: installed };
  await mkdir(join(dshHome(), 'skill-sync'), { recursive: true });
  await writeLedger(records);
}
export async function sourceDigest(path) { return digestTree(path); }
function workspaceList(ctx) {
  try { const ws = ctx?.workspace; if (typeof ws?.roots === 'function') return ws.roots().map(r => r.path).filter(Boolean); if (Array.isArray(ws?.list)) return ws.list.map(w => w.path).filter(Boolean); } catch {}
  return [];
}
async function inspect(ctx, input) {
  const { rootId, name } = input ?? {};
  if (typeof rootId !== 'string' || typeof name !== 'string' || !isSkillName(name)) return blocked('Invalid skill identity');
  const workspaces = workspaceList(ctx);
  const root = rootById(writableRoots(workspaces), rootId);
  if (!root) return blocked('Unknown skill root');
  const rootStat = await lstat(root.path);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return blocked('Skill root is not a real directory');
  const matches = (await enumerateRoot(root)).filter(item => item.name === name);
  if (matches.length !== 1 || matches[0].kind !== 'directory' || matches[0].path !== join(root.path, name)) return blocked('Installed skill is missing or ambiguous');
  const record = (await ledger())[key(rootId, name)];
  if (!record || typeof record.sourcePath !== 'string' || typeof record.sourceHash !== 'string' || typeof record.installedHash !== 'string') return blocked('No trusted import origin and baseline');
  const reports = await scanSources(SYNC_SOURCES, [], workspaces[0]);
  const candidates = reports.flatMap(report => report.candidates).filter(candidate => candidate.name === name);
  if (candidates.length !== 1 || candidates[0].path !== record.sourcePath || candidates[0].sourceId !== record.sourceId) return blocked('Source is missing or ambiguous');
  const sourceHash = await digestTree(record.sourcePath);
  const installedHash = await digestTree(matches[0].path, true);
  if (installedHash !== record.installedHash) return blocked('Installed skill has local modifications');
  const text = await readFile(join(matches[0].path, 'SKILL.md'), 'utf8');
  const enabled = readSkillMeta(text)?.modelInvocable;
  if (typeof enabled !== 'boolean') return blocked('Installed skill metadata is invalid');
  return { root, name, record, sourceHash, installedHash, enabled };
}
export async function checkUpdate(ctx, input) {
  try {
    const state = await inspect(ctx, input);
    if (state.status) return state;
    if (state.sourceHash === state.record.sourceHash) return { status: 'up_to_date', message: '技能已是最新版本' };
    const token = randomUUID();
    if (checks.size >= 1000) checks.delete(checks.keys().next().value);
    checks.set(token, { rootId: state.root.id, name: state.name, sourceHash: state.sourceHash, installedHash: state.installedHash, enabled: state.enabled, sourcePath: state.record.sourcePath, expires: Date.now() + 600000 });
    return { status: 'update_available', message: '发现可用更新', token };
  } catch (error) { return blocked(error instanceof Error ? error.message : String(error)); }
}
export async function applyUpdate(ctx, input) {
  const token = typeof input?.token === 'string' ? checks.get(input.token) : undefined;
  if (input?.token) checks.delete(input.token);
  if (!token || token.expires < Date.now() || token.rootId !== input?.rootId || token.name !== input?.name) return blocked('Invalid or expired update token');
  let staging;
  try {
    const state = await inspect(ctx, input);
    if (state.status) return state;
    if (state.sourceHash !== token.sourceHash || state.installedHash !== token.installedHash || state.enabled !== token.enabled || state.record.sourcePath !== token.sourcePath) return blocked('Skill or source changed since check');
    staging = join(state.root.path, `.update-${randomUUID()}`);
    await copyTree(state.record.sourcePath, staging);
    if (await digestTree(staging) !== token.sourceHash) throw new Error('Source changed during copy');
    const skillFile = join(staging, 'SKILL.md');
    const text = await readFile(skillFile, 'utf8');
    if (readSkillMeta(text)?.name !== state.name) throw new Error('Source skill name is invalid');
    await writeFile(skillFile, setFlag(text, 'disable-model-invocation', !state.enabled));
    const stagedHash = await digestTree(staging, true);
    const current = await inspect(ctx, input);
    if (current.status || current.sourceHash !== token.sourceHash || current.installedHash !== token.installedHash || current.enabled !== token.enabled || current.record.sourcePath !== token.sourcePath) throw new Error('Skill or source changed during update');
    const target = join(state.root.path, state.name);
    const backup = join(state.root.path, `.update-backup-${randomUUID()}`);
    await rename(target, backup);
    try { await rename(staging, target); staging = undefined; }
    catch (error) { await rename(backup, target); throw error; }
    try {
      const records = await ledger();
      records[key(state.root.id, state.name)] = { ...state.record, sourceHash: token.sourceHash, installedHash: stagedHash };
      await writeLedger(records);
    } catch (error) {
      return { status: 'updated', warning: true, backupPath: backup, message: `技能已更新，但来源记录保存失败；后续更新将被阻止。旧版本保存在 ${backup}，请手动恢复或排查记录文件：${error instanceof Error ? error.message : String(error)}` };
    }
    return { status: 'updated', message: '技能已更新，旧版本已保留为隐藏备份' };
  } catch (error) { return blocked(error instanceof Error ? error.message : String(error)); }
  finally { if (staging) await rm(staging, { recursive: true, force: true }).catch(() => {}); }
}
