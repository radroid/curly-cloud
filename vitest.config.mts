import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  // tsconfig sets jsx: preserve for Next; tests that server-render components need it compiled.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '.open-next/**', 'private/**'],
    environment: 'node',
  },
})
