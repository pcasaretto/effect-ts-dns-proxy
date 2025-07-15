import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        'test-*.js',
        'vitest.config.ts'
      ]
    }
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  }
})