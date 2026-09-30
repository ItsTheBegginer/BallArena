import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const frontendPath = resolve(projectRoot, 'frontend/src/data/matches.json');
const workerPath = resolve(projectRoot, 'worker/src/matches.json');

const matches = JSON.parse(await readFile(frontendPath, 'utf8'));
if (!Array.isArray(matches)) {
  throw new Error('frontend/src/data/matches.json must contain an array.');
}

await writeFile(workerPath, `${JSON.stringify(matches, null, 2)}\n`, 'utf8');
console.log(`Synced ${matches.length} curated matches to the Worker schedule.`);
