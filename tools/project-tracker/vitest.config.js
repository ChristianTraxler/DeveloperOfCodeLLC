import { defineConfig } from 'vitest/config'

// Standalone test config so vitest doesn't load the app's Vite + React plugin
// (these are plain-JS unit tests with no JSX to transform).
export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,jsx}'],
  },
})
