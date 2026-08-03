import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/EduCode/',
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests-e2e/**'],
  },
  server: {
    watch: {
      ignored: ['**/EduCode EduBox/**']
    }
  }
})
