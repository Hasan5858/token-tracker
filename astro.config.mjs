import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const API_PORT = process.env.API_PORT ?? '4748';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  server: { port: Number(process.env.WEB_PORT ?? 4321), host: '127.0.0.1' },
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    build: { chunkSizeWarningLimit: 1200 },
    server: { proxy: { '/api': `http://127.0.0.1:${API_PORT}` } },
  },
});
