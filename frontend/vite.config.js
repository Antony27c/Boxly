import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Con VITE_API_URL vacío, el front llama a /api en su mismo origen y vite lo
    // reenvía al backend. Sirve para abrir la app desde otro dispositivo de la red.
    proxy: {
      '/api': process.env.BOXLY_API_PROXY ?? 'http://localhost:8000',
      '/uploads': process.env.BOXLY_API_PROXY ?? 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
