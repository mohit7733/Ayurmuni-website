import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiTarget = String(env.VITE_API_BASE || 'https://ayurmuni.aimantra.info/')
    .replace(/\/+$/, '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
        '/ws': {
          target: apiTarget,
          changeOrigin: true,
          secure: true,
          ws: true,
        },
      },
    },
  };
});
