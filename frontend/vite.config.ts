/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // three.js alone is ~600 kB; split chunks later if load time becomes a problem.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    // UI tests mock the WebGL facility; pure simulation tests run in Node.
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts', 'src/game/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/__tests__/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
})
