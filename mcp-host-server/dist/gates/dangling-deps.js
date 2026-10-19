import { lstatSync, readdirSync, readlinkSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
function isDangling(p) {
    try {
        if (!lstatSync(p).isSymbolicLink())
            return false;
    }
    catch {
        return false;
    }
    try {
        statSync(p);
        return false;
    }
    catch {
        return true;
    }
}
/** Broken symlinks among node_modules' top-level entries (scoped packages included). */
export function countDanglingLinks(nodeModulesDir) {
    let count = 0;
    let entries;
    try {
        entries = readdirSync(nodeModulesDir);
    }
    catch {
        return 0;
    }
    for (const name of entries) {
        const p = join(nodeModulesDir, name);
        if (name.startsWith('@') && !isDangling(p)) {
            try {
                for (const sub of readdirSync(p))
                    if (isDangling(join(p, sub)))
                        count++;
            }
            catch { /* not a dir */ }
        }
        else if (isDangling(p)) {
            count++;
        }
    }
    return count;
}
/**
 * Explains why `import(name)` failed when the cause is a dangling node_modules
 * symlink, which otherwise reads as "not installed". Walks Node's resolution
 * path from `fromDir` and reports the first `node_modules/<name>` that exists
 * as a link but points nowhere. Returns null when no such link is found.
 */
export function describeDanglingModule(names, fromDir) {
    for (let dir = fromDir;; dir = dirname(dir)) {
        const modules = join(dir, 'node_modules');
        for (const name of names) {
            const link = join(modules, name);
            if (!isDangling(link))
                continue;
            const total = countDanglingLinks(modules);
            return `${link} is a dangling symlink (-> ${readlinkSync(link)}); `
                + `${total} top-level link(s) in ${modules} are broken. `
                + 'Its links were likely rewritten by a pnpm install run in a since-deleted worktree. '
                + `Repair: cd ${dir} && CI=true pnpm install --frozen-lockfile`;
        }
        if (dirname(dir) === dir)
            return null;
    }
}
