import { resolve } from 'path';
import { precompressTree } from './precompress.js';

// Build step (package.json `build`): `node dist-server/server/precompress-cli.js dist`.
const root = resolve(process.argv[2] ?? 'dist');
const r = await precompressTree(root);
const mb = (n: number) => (n / 1048576).toFixed(1);
console.log(
  `[precompress] ${r.files} files, ${mb(r.bytesIn)} MB → br ${mb(r.bytesBr)} MB / gz ${mb(r.bytesGz)} MB ` +
  `(${r.removed} stale variants removed, ${r.ms} ms) in ${root}`,
);
