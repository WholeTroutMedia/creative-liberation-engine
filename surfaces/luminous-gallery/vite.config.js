import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3001,
    host: true,
    watch: {
      usePolling: true
    }
  }
});
