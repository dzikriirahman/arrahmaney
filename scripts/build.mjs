import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const files = [
  'index.html',
  'auth.js',
  'advisor.js',
  'kulakan.js',
  'kulakan.css',
  'mobile.css',
  'mobile.js',
  'manifest.webmanifest',
  'icons'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of files) {
  await cp(path.join(root, file), path.join(dist, file), { recursive: true });
}
console.log(`Built ${files.length} web assets into dist.`);
