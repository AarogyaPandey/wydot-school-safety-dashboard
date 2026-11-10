import type { Plugin } from 'vite';
import { LAYER_FILES, loadAnalysis, loadLayer, loadResearchDataset, sourceOptions, type LayerKey } from './source-data';

export function isLocalRequest(address: string | undefined, host: string | undefined, origin: string | undefined, fetchSite?: string): boolean {
  if (!address || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false;
  if (!host || !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return false;
  if (fetchSite === 'cross-site') return false;
  if (!origin) return true;
  try { const u = new URL(origin); return u.host === host && u.protocol === 'http:'; } catch { return false; }
}
export function localResearchData(env: Record<string, string>): Plugin {
  const options = sourceOptions(env);
  let dataset: ReturnType<typeof loadResearchDataset> | undefined;
  return {
    name: 'local-research-data', apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/__research/')) return next();
        res.setHeader('Cache-Control', 'no-store, private');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (req.method !== 'GET' || !isLocalRequest(req.socket.remoteAddress, req.headers.host, req.headers.origin, req.headers['sec-fetch-site'] as string | undefined)) {
          res.statusCode = 403; res.end(JSON.stringify({ error: 'Research data is available only to a same-origin loopback preview.' })); return;
        }
        void (async () => {
          if (url.pathname === '/__research/dataset') {
            dataset ??= loadResearchDataset(options).catch(error => { dataset = undefined; throw error; });
            res.end(JSON.stringify(await dataset)); return;
          }
          if (url.pathname === '/__research/analysis') { res.end(JSON.stringify(await loadAnalysis(options))); return; }
          const key = url.pathname.slice('/__research/layers/'.length);
          if (url.pathname.startsWith('/__research/layers/') && Object.hasOwn(LAYER_FILES, key)) {
            const year = Number(url.searchParams.get('year') || 2025);
            if (![2021, 2022, 2023, 2024, 2025].includes(year)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Unsupported traffic year.' })); return; }
            res.end(JSON.stringify(await loadLayer(options, key as LayerKey, year))); return;
          }
          res.statusCode = 404; res.end(JSON.stringify({ error: 'Unknown research resource.' }));
        })().catch(error => {
          server.config.logger.error(`Local Phase 2 adapter: ${error instanceof Error ? error.message : 'source read failed'}`);
          if (!res.headersSent) res.statusCode = 503;
          res.end(JSON.stringify({ error: 'The local Phase 2 sources could not be loaded. Check the source locations and Python installation described in README.md.' }));
        });
      });
    },
  };
}
