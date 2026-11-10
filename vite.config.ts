import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localResearchData } from './server/local-data';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'PHASE2_');
  const pythonEnv = loadEnv(mode, process.cwd(), 'PYTHON_');
  return {
    plugins: [react(), ...(command === 'serve' && mode === 'research' ? [localResearchData({ ...env, ...pythonEnv })] : [])],
    server: {
      host: '127.0.0.1', port: 5173, strictPort: true,
      fs: { strict: true, allow: [process.cwd()] },
      cors: false,
    },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: {
      sourcemap: false,
      rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], leaflet: ['leaflet', 'react-leaflet'] } } },
    },
  };
});
