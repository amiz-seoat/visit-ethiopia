/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  if (command === 'build' && mode === 'production' && !env.VITE_API_URL && !env.VITE_API_BASE_URL) {
    throw new Error(
      'VITE_API_URL (or VITE_API_BASE_URL) must be set for production builds (e.g. https://your-api.onrender.com/api/v1)'
    )
  }
  return {
    plugins: [react()],
    server: {
      port: 5199,
      strictPort: false,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
