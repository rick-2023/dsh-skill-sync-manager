/**
 * External agent skill library scanner (read-only).
 *
 * Scans configured Claude Code / Codex / Cursor / Gemini CLI skill
 * directories for Agent Skills bundles (`<name>/SKILL.md`) and reports each
 * candidate with its import status against the station's writable roots.
 * Nothing outside the station's own roots is ever modified here.
 */
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readSkillMeta } from './frontmatter.js';
import { expandHome } from './roots.js';
/** Default scan sources for the four supported agents. */
export const DEFAULT_SOURCES = [
    { id: 'claude', label: 'Claude Code', userDirs: ['~/.claude/skills'], projectDirs: ['.claude/skills'] },
    { id: 'codex', label: 'Codex CLI', userDirs: ['~/.codex/skills'], projectDirs: ['.codex/skills'] },
    { id: 'cursor', label: 'Cursor', userDirs: ['~/.cursor/skills'], projectDirs: ['.cursor/skills'] },
    { id: 'gemini', label: 'Gemini CLI', userDirs: ['~/.gemini/antigravity/skills', '~/.gemini/skills'], projectDirs: ['.gemini/skills'] },
];
/**
 * Scan every configured source directory and classify candidates against the
 * currently installed skill names.
 * @param sources - external sources to scan.
 * @param installed - skills already present in the station's writable roots.
 * @param workspace - optional workspace whose project directories are scanned.
 * @returns one report per source, in the given order.
 */
export async function scanSources(sources, installed, workspace) {
    const installedNames = new Set(installed.map(skill => skill.name));
    const reports = [];
    for (const source of sources) {
        const dirs = [
            ...source.userDirs.map(dir => ({ path: expandHome(dir), scope: 'user' })),
            ...(workspace !== undefined
                ? source.projectDirs.map(dir => ({ path: join(workspace, dir), scope: 'project' }))
                : []),
        ];
        const candidates = [];
        const scannedDirs = [];
        const issues = [];
        for (const { path, scope } of dirs) {
            const found = await scanOneDir(source, path, scope, installedNames, issues);
            if (found === null)
                continue;
            scannedDirs.push(path);
            candidates.push(...found);
        }
        candidates.sort((a, b) => a.name.localeCompare(b.name));
        reports.push({ source, candidates, scannedDirs, issues });
    }
    return reports;
}
function recordIssue(issues, source, path, error) {
    if (error?.code === 'ENOENT') return;
    issues.push({ sourceId: source.id, path, code: error?.code ?? 'UNKNOWN', message: error instanceof Error ? error.message : String(error) });
}
async function scanOneDir(source, dir, scope, installedNames, issues) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    }
    catch (error) {
        recordIssue(issues, source, dir, error);
        return null;
    }
    const candidates = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.'))
            continue;
        const skillDir = join(dir, entry.name);
        const skillFile = join(skillDir, 'SKILL.md');
        let text;
        try {
            text = await readFile(skillFile, 'utf8');
        }
        catch (error) {
            recordIssue(issues, source, skillFile, error);
            continue;
        }
        const meta = readSkillMeta(text);
        const name = meta?.name ?? entry.name;
        const size = await dirSize(skillDir);
        candidates.push({
            sourceId: source.id,
            sourceLabel: source.label,
            name,
            description: meta?.description ?? '',
            path: skillDir,
            scope,
            sizeBytes: size,
            conflict: installedNames.has(name),
        });
    }
    return candidates;
}
const SIZE_CAP_BYTES = 512 * 1024 * 1024;
/**
 * Total size of regular files under a directory; symlinks are skipped and
 * the accumulated byte count is capped, so vendored trees stay bounded.
 * @param dir - directory to measure.
 * @returns accumulated byte count, capped to keep scans bounded.
 */
export async function dirSize(dir) {
    let total = 0;
    const walk = async (current) => {
        if (total >= SIZE_CAP_BYTES)
            return;
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (total >= SIZE_CAP_BYTES)
                return;
            const path = join(current, entry.name);
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory()) {
                await walk(path);
            }
            else if (entry.isFile()) {
                const stat = await lstat(path).catch(() => null);
                if (stat !== null)
                    total += stat.size;
            }
        }
    };
    await walk(dir);
    return total;
}
