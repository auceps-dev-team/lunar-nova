import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : './',
  plugins: [react()],
  server: {
    port: process.env.VITE_DEV_PORT ? parseInt(process.env.VITE_DEV_PORT) : 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    }
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          ui: ['lucide-react', 'recharts'],
          i18n: ['i18next', 'react-i18next']
        }
      }
    }
  }
}))
