import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { scanSources } from './vendor/scanner.js';
import { importItems } from './vendor/importer.js';
import { assertContained, ensureRoot, enumerateRoot, rootById, writableRoots } from './vendor/roots.js';
import { isSkillName } from './vendor/importer.js';
import { moveToTrash } from './vendor/trash.js';
import { setFlag } from './vendor/frontmatter.js';
import { SYNC_SOURCES } from './sources.js';
import { recordOrigin, sourceDigest } from './update.js';

const STATE_SCHEMA = 1;
const IMPORT_CHUNK = 200;
const DETAIL_LIMIT = 200;

export function dshHome() {
  return resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'));
}

export function statePath() {
  return join(dshHome(), 'skill-sync', 'state.json');
}

export async function readState() {
  try {
    const raw = await readFile(statePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      schemaVersion: STATE_SCHEMA,
      lastRunAt: null,
      lastRunTrigger: null,
      totals: { imported: 0, skipped: 0, failed: 0 },
      perSource: {},
      errors: [],
    };
  }
}

export async function writeState(state) {
  await mkdir(join(dshHome(), 'skill-sync'), { recursive: true });
  await writeFile(statePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function workspacesFromCtx(ctx) {
  // Cordis throws if a service was not declared in inject. This plugin only
  // needs global skill roots; a missing workspace service must not fail the API.
  let ws;
  try {
    ws = ctx?.workspace;
  } catch {
    return [];
  }
  if (!ws) return [];
  try {
    if (typeof ws.roots === 'function') {
      return ws.roots().map((r) => r.path).filter(Boolean);
    }
    if (Array.isArray(ws.list)) return ws.list.map((w) => w.path).filter(Boolean);
  } catch {
    return [];
  }
  return [];
}

async function installedForWorkspaces(workspaces) {
  const roots = writableRoots(workspaces);
  const installed = [];
  for (const root of roots) {
    installed.push(...(await enumerateRoot(root)));
  }
  return { roots, installed };
}

function emptySourceStats() {
  return { imported: 0, skipped: 0, failed: 0, candidates: 0 };
}

async function moveInstalledSkillToTrash(path, name, rootId) {
  return moveToTrash(path, name, rootId);
}

/**
 * @param {*} ctx Cordis context (workspaces)
 * @param {{ targetRootId: string, enabledSourceIds?: string[]|null }} config
 * @param {string} trigger
 */
export async function runSync(ctx, config, trigger = 'manual') {
  const workspaces = workspacesFromCtx(ctx);
  const { roots, installed } = await installedForWorkspaces(workspaces);
  const sources = SYNC_SOURCES.filter(
    (s) =>
      !config.enabledSourceIds?.length || config.enabledSourceIds.includes(s.id),
  );
  const reports = await scanSources(sources, installed, workspaces[0]);
  const perSource = {};
  const toImport = [];
  const details = [];
  const warnings = [];
  const scanIssues = reports.flatMap(report => report.issues);
  let detailTotal = 0;
  const addDetail = (name, sourceId, status, reason, message) => {
    detailTotal += 1;
    if (details.length < DETAIL_LIMIT) details.push({ name, sourceId, status, reason, message });
  };

  for (const report of reports) {
    const sourceId = report.source.id;
    perSource[sourceId] = emptySourceStats();
    for (const c of report.candidates) {
      perSource[sourceId].candidates += 1;
      if (c.conflict) {
        perSource[sourceId].skipped += 1;
        addDetail(c.name, sourceId, 'skipped', 'already_exists', '技能已存在');
        continue;
      }
      toImport.push({ sourcePath: c.path, sourceId, name: c.name });
    }
  }

  const root = rootById(roots, config.targetRootId || 'user-dsh');
  if (!root) throw new Error(`unknown target root: ${config.targetRootId}`);

  let imported = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < toImport.length; i += IMPORT_CHUNK) {
    const chunk = toImport.slice(i, i + IMPORT_CHUNK);
    try {
      const baselines = await Promise.all(chunk.map(item => sourceDigest(item.sourcePath).then(value => ({ value }), error => ({ error }))));
      const outcomes = await importItems(
        root,
        chunk.map((item) => ({ sourcePath: item.sourcePath })),
        'skip',
        moveInstalledSkillToTrash,
      );
      for (let j = 0; j < chunk.length; j += 1) {
        const item = chunk[j];
        const outcome = outcomes[j];
        const sourceId = item.sourceId;
        const name = outcome?.name || item.name;
        if (outcome && !outcome.error && ['imported', 'replaced', 'renamed'].includes(outcome.status)) {
          imported += 1;
          perSource[sourceId].imported += 1;
          addDetail(name, sourceId, 'imported', 'imported', '导入成功');
          if (outcome.status === 'imported') {
            try {
              if (baselines[j].error) throw baselines[j].error;
              await recordOrigin(root, name, sourceId, item.sourcePath, baselines[j].value);
              if (await sourceDigest(item.sourcePath) !== baselines[j].value) {
                throw new Error('来源在导入过程中发生变化，未能确认来源记录');
              }
            } catch (error) {
              const message = `来源记录失败：${error instanceof Error ? error.message : String(error)}`;
              warnings.push({ name, sourceId, reason: 'origin_record_failed', message });
              errors.push({ name, error: `origin record: ${String(error)}` });
            }
          }
        } else if (outcome?.status === 'skipped' && !outcome.error) {
          perSource[sourceId].skipped += 1;
          addDetail(name, sourceId, 'skipped', 'already_exists', '技能已存在');
        } else {
          const message = String(outcome?.error || '导入未返回结果');
          failed += 1;
          perSource[sourceId].failed += 1;
          errors.push({ name, error: message });
          addDetail(name, sourceId, 'failed', 'import_failed', message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += chunk.length;
      errors.push({ error: message });
      for (const item of chunk) {
        perSource[item.sourceId].failed += 1;
        addDetail(item.name, item.sourceId, 'failed', 'import_failed', message);
      }
    }
  }

  const state = {
    schemaVersion: STATE_SCHEMA,
    lastRunAt: new Date().toISOString(),
    lastRunTrigger: trigger,
    targetRootId: root.id,
    totals: {
      imported,
      failed,
      skipped: Object.values(perSource).reduce((n, s) => n + s.skipped, 0),
    },
    perSource,
    errors: errors.slice(0, 50),
    details,
    detailTotal,
    detailsTruncated: detailTotal > details.length,
    scanIssues,
    warnings,
  };
  await writeState(state);
  return state;
}

export async function fetchOverview(ctx) {
  const workspaces = workspacesFromCtx(ctx);
  const { roots, installed } = await installedForWorkspaces(workspaces);
  const scan = { reports: await scanSources(SYNC_SOURCES, installed, workspaces[0]) };
  const groups = [];
  for (const root of roots) {
    groups.push({
      rootId: root.id,
      label: root.label,
      path: root.path,
      skills: await enumerateRoot(root),
    });
  }
  const state = await readState();
  return { scan, skills: { groups }, state, sources: SYNC_SOURCES };
}

export async function batchToggle(ctx, items, modelInvocable) {
  const workspaces = workspacesFromCtx(ctx);
  const { roots } = await installedForWorkspaces(workspaces);
  const outcomes = [];
  const { readFile: rf, writeFile: wf } = await import('node:fs/promises');
  const { join: pathJoin } = await import('node:path');
  const value = !modelInvocable;

  for (const item of items) {
    try {
      const root = rootById(roots, item.rootId);
      if (!root) throw new Error('unknown root');
      const skills = await enumerateRoot(root);
      const skill = skills.find((s) => s.name === item.name);
      if (!skill) throw new Error('skill not found');
      const skillFile =
        skill.kind === 'file' ? skill.path : pathJoin(skill.path, 'SKILL.md');
      const text = await rf(skillFile, 'utf8');
      await wf(skillFile, setFlag(text, 'disable-model-invocation', value), 'utf8');
      outcomes.push({ name: item.name, ok: true });
    } catch (error) {
      outcomes.push({
        name: item.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}

function yamlScalar(value) {
  return JSON.stringify(String(value).replace(/\s+/g, ' ').trim());
}

/**
 * Create one new skill directory under the personal or first workspace root.
 * @param ctx - host context, used only to discover workspace roots.
 * @param input - name, description, and scope (`personal` or `workspace`).
 * @returns the created skill identity.
 */
export async function createSkill(ctx, input) {
  const name = String(input?.name ?? '').trim();
  const description = String(input?.description ?? '').replace(/\s+/g, ' ').trim();
  const scope = input?.scope === 'workspace' ? 'workspace' : 'personal';
  if (!isSkillName(name)) throw new Error('名称需为 kebab-case，例如 my-skill');
  if (!description) throw new Error('请填写一行描述');
  const roots = writableRoots(workspacesFromCtx(ctx));
  const root = scope === 'workspace'
    ? roots.find((item) => item.id.startsWith('project-dsh:'))
    : rootById(roots, 'user-dsh');
  if (!root) throw new Error(scope === 'workspace' ? '当前没有工作区' : '找不到个人技能目录');
  const existing = await enumerateRoot(root);
  if (existing.some((skill) => skill.name === name)) throw new Error('同名技能已存在');
  await ensureRoot(root);
  const dir = assertContained(root, join(root.path, name));
  await mkdir(dir);
  const file = `---\nname: ${name}\ndescription: ${yamlScalar(description)}\n---\n\n# ${name}\n`;
  await writeFile(join(dir, 'SKILL.md'), file, 'utf8');
  return { name, rootId: root.id, scope };
}
