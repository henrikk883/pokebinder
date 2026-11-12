import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // Since Node 26 the default workers no longer find their test suite (Vitest 5.0.3);
    // this mode runs every file in a context of its own and works on Node 24 and 26 alike.
    pool: 'vmThreads',
  },
})
