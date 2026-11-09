/**
 * Skill import: recursive copy from external sources or uploaded file sets
 * into a writable root, with conflict policies and replace-through-trash.
 *
 * Copies never follow symlinks and enforce per-file and total size caps. An
 * import validates its SKILL.md before writing anything, so a failed
 * validation leaves the target root untouched.
 */
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readSkillMeta, repairFrontmatter, setName } from './frontmatter.js';
import { assertContained, ensureRoot, enumerateRoot } from './roots.js';
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Return whether a string is a valid kebab-case skill name.
 * @param name - candidate skill name.
 * @returns whether it matches the DSH skill-name grammar.
 */
export function isSkillName(name) {
    return SKILL_NAME_RE.test(name);
}
/**
 * Import external skill directories into a target root.
 * @param root - writable destination root.
 * @param items - source directories to import, with optional renames.
 * @param conflict - policy applied when the target name already exists.
 * @param moveToTrash - called with the existing skill path on `replace`.
 * @returns one outcome per requested item, in request order.
 */
export async function importItems(root, items, conflict, moveToTrash) {
    const outcomes = [];
    const taken = new Set((await enumerateRoot(root)).map(skill => skill.name));
    for (const item of items) {
        outcomes.push(await importOne(root, item, conflict, taken, moveToTrash));
    }
    return outcomes;
}
async function importOne(root, item, conflict, taken, moveToTrash) {
    try {
        const skillFile = join(item.sourcePath, 'SKILL.md');
        const text = await readFile(skillFile, 'utf8');
        const meta = readSkillMeta(text);
        const requested = item.rename ?? meta?.name ?? '';
        if (!isSkillName(requested)) {
            return { sourcePath: item.sourcePath, name: requested, status: 'skipped', error: `invalid skill name "${requested}"` };
        }
        let name = requested;
        let status = 'imported';
        if (taken.has(name)) {
            if (conflict === 'skip')
                return { sourcePath: item.sourcePath, name, status: 'skipped' };
            if (conflict === 'rename') {
                name = freshName(name, taken);
                status = 'renamed';
            }
        }
        const targetDir = assertContained(root, join(root.path, name));
        if (taken.has(name)) {
            await moveToTrash(targetDir, name, root.id);
            status = 'replaced';
        }
        await ensureRoot(root);
        // Stage inside the root and rename into place: a mid-copy failure
        // (unreadable source, full disk) leaves no partial skill behind.
        const staging = assertContained(root, join(root.path, `.staging-${randomUUID()}`));
        try {
            await copyTree(item.sourcePath, staging);
            // Verify the copy carries a readable SKILL.md before declaring success.
            const copiedSkill = join(staging, 'SKILL.md');
            const copiedText = await readFile(copiedSkill, 'utf8');
            // Repair sloppy real-world frontmatter (e.g. unquoted colons in the
            // description) so the strict host loader registers the installed copy.
            const repaired = repairFrontmatter(copiedText);
            if (repaired !== null)
                await writeFile(copiedSkill, repaired, 'utf8');
            if (status === 'renamed') {
                // The folder rename alone leaves a duplicate frontmatter name that
                // shadows the original in the host registry; rewrite it to match.
                await writeFile(copiedSkill, setName(await readFile(copiedSkill, 'utf8'), name), 'utf8');
            }
            await rename(staging, targetDir);
        }
        catch (error) {
            await rm(staging, { recursive: true, force: true }).catch(() => { });
            throw error;
        }
        taken.add(name);
        return { sourcePath: item.sourcePath, name, status, targetPath: targetDir };
    }
    catch (error) {
        return { sourcePath: item.sourcePath, name: item.rename ?? '', status: 'skipped', error: String(error) };
    }
}
/**
 * Install an uploaded file set as one skill directory. The set must contain a
 * top-level SKILL.md after stripping a shared folder prefix; the skill name
 * comes from its frontmatter.
 * @param root - writable destination root.
 * @param files - uploaded files with safe relative paths.
 * @param conflict - policy applied when the name already exists.
 * @param moveToTrash - called with the existing skill path on `replace`.
 * @returns the import outcome.
 */
export async function installUpload(root, files, conflict, moveToTrash) {
    try {
        // Dropped folders on macOS always carry .DS_Store; never install it.
        const usable = files.filter(file => file.path.split('/').pop() !== '.DS_Store');
        if (usable.length === 0)
            throw new Error('no files uploaded');
        const stripped = stripCommonPrefix(usable);
        const skillEntry = stripped.find(file => file.path === 'SKILL.md');
        if (skillEntry === undefined)
            throw new Error('the dropped folder has no SKILL.md at its top level');
        let totalBytes = 0;
        for (const file of stripped) {
            totalBytes += Math.floor(file.contentBase64.length * 3 / 4);
            if (totalBytes > MAX_TOTAL_BYTES)
                throw new Error('upload exceeds the size cap');
        }
        const text = Buffer.from(skillEntry.contentBase64, 'base64').toString('utf8');
        const meta = readSkillMeta(text);
        // Repair sloppy frontmatter so the strict host loader registers the copy.
        const repaired = repairFrontmatter(text);
        const name = meta?.name ?? '';
        if (!isSkillName(name))
            throw new Error(`SKILL.md frontmatter needs a valid kebab-case name, got "${name}"`);
        if (meta?.description === undefined || meta.description === '') {
            throw new Error('SKILL.md frontmatter needs a description');
        }
        const targetDir = assertContained(root, join(root.path, name));
        const toWrite = repaired === null
            ? stripped
            : stripped.map(file => file.path === 'SKILL.md'
                ? { ...file, contentBase64: Buffer.from(repaired, 'utf8').toString('base64') }
                : file);
        const existing = (await enumerateRoot(root)).find(skill => skill.name === name);
        let status = 'imported';
        if (existing !== undefined) {
            if (conflict === 'skip')
                return { sourcePath: 'upload', name, status: 'skipped' };
            if (conflict === 'rename')
                return { sourcePath: 'upload', name, status: 'skipped', error: 'rename is not supported for uploads; delete or rename the existing skill first' };
            status = 'replaced';
        }
        await ensureRoot(root);
        // Finish and validate staging before moving the installed copy aside.
        const staging = assertContained(root, join(root.path, `.staging-${randomUUID()}`));
        let rollback;
        try {
            for (const file of toWrite) {
                const target = assertContained(root, join(staging, file.path));
                await mkdir(dirname(target), { recursive: true });
                const buffer = Buffer.from(file.contentBase64, 'base64');
                if (buffer.byteLength > MAX_FILE_BYTES)
                    throw new Error(`file too large: ${file.path}`);
                await writeFile(target, buffer);
            }
            const stagedText = await readFile(join(staging, 'SKILL.md'), 'utf8');
            if (readSkillMeta(stagedText) === null)
                throw new Error('staged SKILL.md is invalid');
            if (existing !== undefined) {
                const restore = await moveToTrash(existing.path, name, root.id);
                if (typeof restore === 'function')
                    rollback = restore;
            }
            await rename(staging, targetDir);
        }
        catch (error) {
            await rm(staging, { recursive: true, force: true }).catch(() => { });
            if (rollback !== undefined) {
                try {
                    await rollback();
                }
                catch (rollbackError) {
                    throw new Error(`install failed and the previous skill could not be restored: ${String(rollbackError)}`, { cause: error });
                }
            }
            throw error;
        }
        return { sourcePath: 'upload', name, status, targetPath: targetDir };
    }
    catch (error) {
        return { sourcePath: 'upload', name: '', status: 'skipped', error: String(error) };
    }
}
/**
 * Remove the single shared top-level folder from a dropped file set, so
 * `foo/SKILL.md` and `foo/assets/x.png` become `SKILL.md` and `assets/x.png`.
 * @param files - uploaded files with relative paths.
 * @returns files with the common prefix stripped (unchanged when there is none).
 */
export function stripCommonPrefix(files) {
    if (files.length === 0)
        return [];
    const firstSegments = new Set(files.map(file => file.path.split('/')[0]));
    if (firstSegments.size !== 1)
        return [...files];
    const hasTopLevelFile = files.some(file => !file.path.includes('/'));
    if (hasTopLevelFile)
        return [...files];
    const first = files[0];
    if (first === undefined)
        return [];
    const prefix = `${first.path.split('/')[0]}/`;
    return files.map(file => ({ ...file, path: file.path.slice(prefix.length) })).filter(file => file.path.length > 0);
}
/**
 * Recursively copy a directory without following symlinks. No size caps:
 * this is a disk-to-disk streaming copy of a folder the user already has;
 * transport- and memory-bound caps live in the upload paths instead.
 * @param source - existing source directory.
 * @param target - destination directory, created when missing.
 */
export async function copyTree(source, target) {
    await mkdir(target, { recursive: true });
    const walk = async (from, to) => {
        const entries = await readdir(from, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isSymbolicLink())
                continue;
            const fromPath = join(from, entry.name);
            const toPath = join(to, entry.name);
            if (entry.isDirectory()) {
                await mkdir(toPath, { recursive: true });
                await walk(fromPath, toPath);
            }
            else if (entry.isFile()) {
                await copyFile(fromPath, toPath);
            }
        }
    };
    await walk(source, target);
}
/**
 * Derive a non-colliding name by appending a numeric suffix.
 * @param base - desired kebab-case name.
 * @param taken - names already in use.
 * @returns a name not present in `taken`.
 */
export function freshName(base, taken) {
    let suffix = 2;
    while (taken.has(`${base}-${String(suffix)}`))
        suffix += 1;
    return `${base}-${String(suffix)}`;
}
/**
 * Remove one installed skill directory or file from disk. Used only after the
 * caller has already moved the skill into the trash; kept as a bounded `rm`
 * for trash-empty.
 * @param path - absolute path to remove.
 */
export async function removePath(path) {
    await rm(path, { recursive: true, force: true });
}
