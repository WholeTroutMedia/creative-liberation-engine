import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5071,
    proxy: {
      '/api': {
        target: 'http://localhost:5070',
        changeOrigin: true,
      },
    },
  },
});
