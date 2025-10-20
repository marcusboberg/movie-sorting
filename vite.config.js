import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'movie-sorting:spa-fallback',
      apply: 'build',
      closeBundle() {
        const outDir = resolve(process.cwd(), 'dist');
        const indexPath = resolve(outDir, 'index.html');
        const fallbackPath = resolve(outDir, '404.html');

        if (!existsSync(indexPath)) {
          return;
        }

        copyFileSync(indexPath, fallbackPath);
      },
    },
  ],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
