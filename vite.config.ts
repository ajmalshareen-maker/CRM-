import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.REPLYFLOW_API || 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/ws': { target: API.replace('http', 'ws'), ws: true },
      '/widget.js': { target: API, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
