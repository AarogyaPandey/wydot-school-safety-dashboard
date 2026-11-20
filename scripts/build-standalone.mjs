import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filename = 'School-Zone-Safety.html';
const ignored = await readFile(path.join(root, '.gitignore'), 'utf8');
assert(ignored.split(/\r?\n/).includes(`/${filename}`), 'The local research HTML must be excluded from Git before building.');

// Vite's module loader reads the existing TypeScript adapter without opening a
// listening server. Only the build process needs Node/Python/source folders.
const loader = await createServer({ root, configFile: false, publicDir: false, appType: 'custom', server: { middlewareMode: true, hmr: false } });
let snapshot;
try {
  const source = await loader.ssrLoadModule('/server/source-data.ts');
  const options = source.sourceOptions({ ...loadEnv('research', root, 'PHASE2_'), ...loadEnv('research', root, 'PYTHON_') }, root);
  const [dataset, analysis] = await Promise.all([source.loadResearchDataset(options), source.loadAnalysis(options)]);
  const requests = Object.keys(source.LAYER_FILES).flatMap(key => key === 'aadt' ? [2021, 2022, 2023, 2024, 2025].map(year => [key, year]) : [[key, 2025]]);
  const layers = Object.fromEntries(await Promise.all(requests.map(async ([key, year]) => [key === 'aadt' ? `${key}:${year}` : key, await source.loadLayer(options, key, year)])));
  snapshot = { schemaVersion: 1, dataset, analysis, layers };
} finally { await loader.close(); }

// Build a single classic-script bundle: no runtime ESM imports or chunk fetches.
// publicDir:false deliberately prevents copying public/data into another output.
const result = await build({
  root, configFile: false, publicDir: false, mode: 'standalone', plugins: [react()],
  base: './',
  build: {
    write: false, sourcemap: false, minify: 'esbuild', cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { input: path.join(root, 'src/main.tsx'), output: { format: 'iife', inlineDynamicImports: true, name: 'SchoolSafetyDashboard' } },
  },
});
const output = Array.isArray(result) ? result.flatMap(r => r.output) : result.output;
const chunks = output.filter(item => item.type === 'chunk');
assert.equal(chunks.length, 1, 'Standalone HTML must have exactly one JavaScript bundle.');
assert.equal(chunks[0].imports.length, 0, 'Standalone JavaScript must have no external module imports.');
assert.equal(chunks[0].dynamicImports.length, 0, 'Standalone JavaScript must have no dynamic chunk imports.');
const css = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n');
for (const item of output) assert(item.type === 'chunk' || item.fileName.endsWith('.css'), `An asset was not inlined: ${item.fileName}`);
assert(!/url\(\s*['"]?(?!data:|#)[a-z./]/i.test(css), 'Standalone CSS must not depend on local files.');
const favicon = Buffer.from(await readFile(path.join(root, 'public/favicon.svg'))).toString('base64');
const json = JSON.stringify(snapshot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const code = chunks[0].code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#493321"><meta name="robots" content="noindex,nofollow">
<title>Cheyenne School Zone Safety · Local research</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon}">
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>
<body><div id="root"></div><noscript>Enable JavaScript to open the dashboard.</noscript>
<script type="application/json" id="school-safety-local-snapshot">${json}</script>
<script>${code}</script></body></html>`;
// Inspect the actual markup, not HTML strings inside React's JavaScript bundle.
const markup = html.slice(0, html.indexOf('<script>'));
assert(!/<script[^>]+\bsrc=/i.test(markup), 'A standalone HTML script must not load from an external file.');
assert(!/<link[^>]+rel="(?:stylesheet|modulepreload)"/i.test(markup), 'Standalone styles and dependencies must be embedded.');
await writeFile(path.join(root, filename), html, 'utf8');
console.log(`\nCreated ${filename} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB). Double-click it in File Explorer.`);
console.log(`Local snapshot: ${snapshot.dataset.schools.length} schools; ${snapshot.dataset.crashes.length} unique crashes; ${Object.keys(snapshot.layers).length} layer/year snapshots.`);
console.log('Local research use only. This generated file is ignored by Git; redistribution review is still required before sharing or hosting it.');
