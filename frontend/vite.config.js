import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const PROXY_API =
  process.env.VITE_PROXY_API ?? process.env.BOXLY_API_PROXY ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Con VITE_API_URL vacío, el front llama a /api en su mismo origen y vite lo
    // reenvía al backend. Sirve para abrir la app desde otro dispositivo de la red.
    // VITE_PROXY_API elige el backend (ej. http://localhost:8001 para otro worktree).
    proxy: {
      '/api': PROXY_API,
      '/uploads': PROXY_API,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
