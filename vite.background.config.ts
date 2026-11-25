import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/extension/background/serviceWorker.ts'),
      name: 'FormMateBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
