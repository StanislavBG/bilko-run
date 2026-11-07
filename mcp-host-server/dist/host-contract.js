import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** docs/map.md, a separator, then docs/host-contract.md; the contract alone when map.md is missing. */
export function readHostContract(hostRoot) {
    const contract = readFileSync(resolve(hostRoot, 'docs/host-contract.md'), 'utf8');
    const mapPath = resolve(hostRoot, 'docs/map.md');
    if (!existsSync(mapPath))
        return contract;
    return `${readFileSync(mapPath, 'utf8')}\n\n---\n\n${contract}`;
}
