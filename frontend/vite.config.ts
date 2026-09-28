import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js alone is ~600 kB; split chunks later if load time becomes a problem.
    chunkSizeWarningLimit: 1500,
  },
})
