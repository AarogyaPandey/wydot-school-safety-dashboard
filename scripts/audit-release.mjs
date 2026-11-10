import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

async function files(directory, prefix = '') {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]))).flat();
}
const allowedPublic = new Set(['favicon.svg', 'data/manifest.json']);
for (const file of await files('public')) assert(allowedPublic.has(file), `Unreviewed public asset: ${file}`);
const manifest = JSON.parse(await readFile('dist/data/manifest.json', 'utf8'));
assert.equal(manifest.status, 'withheld', 'The release manifest must remain withheld until permissions are reviewed.');
assert.deepEqual(manifest.datasets, [], 'No source datasets are currently cleared for inclusion.');
const output = await files('dist');
for (const file of output) {
  assert(file === 'index.html' || allowedPublic.has(file) || /^assets\/[a-zA-Z0-9_.-]+\.(js|css|svg|png|woff2?)$/.test(file), `Unreviewed build output: ${file}`);
  if (!/\.(js|html|json|css)$/.test(file)) continue;
  const content = await readFile(path.join('dist', file), 'utf8');
  assert(!/__research\/|dashboard_crashes\.csv|Cheyenne_Schools_Listing\.xlsx|crash_date_military_time|node:fs|node:child_process/.test(content), `A private source route or server import entered the production output: ${file}`);
  assert(!/"crash_id"\s*:\s*"?\d|"type"\s*:\s*"FeatureCollection"\s*,\s*"features"\s*:\s*\[\s*\{/.test(content), `Possible embedded source dataset: ${file}`);
}
console.log(`Release audit passed: ${output.length} build files; no source datasets, private routes, or server modules included.`);
