import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: {
    cors: { origin: 'https://www.owlbear.rodeo' },
  },
  build: {
    target: 'es2022',
    rollupOptions: { input: resolve(process.cwd(), 'background.html') },
  },
});
