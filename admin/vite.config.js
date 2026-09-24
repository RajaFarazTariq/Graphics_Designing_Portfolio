import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.CMS_API || 'http://localhost:3000';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': api,
      '/preview': api,
      '/uploads': api,
      '/images': api,
      '^/[^/]+\\.(pdf|jpg|css|js)$': api,
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
