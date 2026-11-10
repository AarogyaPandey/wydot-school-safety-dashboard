import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectDir);
// Use the selected executable directly. Node/npm need not be installed globally.
process.env.PATH = `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}`;

try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || major === 22 && minor < 12) throw new Error(`Node.js 22.12+ is required; found ${process.versions.node}.`);
  const { createServer } = await import('vite');
  const server = await createServer({
    root: projectDir,
    mode: 'research',
    server: { host: '127.0.0.1', port: 5173, strictPort: true, open: process.argv.includes('--no-open') ? false : '/map' },
  });
  await server.listen();
  console.log('\nDashboard ready: http://127.0.0.1:5173/map');
  console.log('Keep this window open while using the dashboard. Press Ctrl+C to stop.\n');
  server.printUrls();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void stop());
  process.on('SIGTERM', () => void stop());
} catch (error) {
  console.error('\nThe dashboard server could not start.');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('If port 5173 is already in use, check the existing dashboard window before starting another copy.');
  console.error('For missing dependencies, run npm ci in the project folder.');
  process.exitCode = 1;
}
