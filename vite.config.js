import { defineConfig } from 'vite';

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'storage-access=(), interest-cohort=()'
};

export default defineConfig({
  base: './',
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { output: { manualChunks: { sqlite: ['@sqlite.org/sqlite-wasm'], zip: ['jszip'] } } }
  }
});
