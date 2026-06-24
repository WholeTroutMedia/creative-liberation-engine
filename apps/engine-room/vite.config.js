import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 3847,
    strictPort: true,
    cors: true,
    allowedHosts: 'all',
    // Same-origin proxy so GenMediaPane can call ComfyUI without browser CORS (target is local/NAS bridge).
    proxy: {
      '/comfy': {
        target: process.env.COMFYUI_PROXY_TARGET || 'http://127.0.0.1:8188',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/comfy/, '') || '/',
      },
    },
  }
})
