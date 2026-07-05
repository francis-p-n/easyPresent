import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Separate from vite.config.js on purpose: the electron/renderer plugins
// rewrite node built-in imports (fs, path) into require() shims that break
// in vitest's ESM environment, and tests don't need them.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  test: {
    environment: 'jsdom'
  }
})
