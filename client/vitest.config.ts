import { defineConfig } from 'vitest/config';

// Config dédiée à Vitest : on n'utilise pas vite.config.ts pour éviter de
// charger le plugin Electron (qui déclenche un build main/preload) pendant les tests.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
    },
  },
});
