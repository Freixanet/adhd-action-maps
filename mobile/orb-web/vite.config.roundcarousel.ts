import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../..');

/** Official Originkit Round Carousel hosted for the Expo WebView. */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@originkit/roundcarousel': resolve(
        repoRoot,
        'src/components/originkit/ui/roundcarousel.tsx'
      ),
      '@shared': resolve(repoRoot, 'shared'),
    },
  },
  server: {
    fs: {
      allow: [__dirname, repoRoot],
    },
  },
  build: {
    outDir: 'dist-round-carousel',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: resolve(__dirname, 'round-carousel.html'),
    },
  },
});
