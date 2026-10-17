import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ops_test?connection_limit=5',
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long-for-testing',
      JWT_EXPIRES_IN: '24h',
      NODE_ENV: 'test',
      PORT: '3001',
      CORS_ORIGIN: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
    },
  },
});