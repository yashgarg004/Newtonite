import { defineConfig } from 'vitest/config';

const testDbUrl =
  process.env.TEST_DATABASE_URL ||
  (process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('/ops_dev', '/ops_test')
    : 'postgresql://postgres:postgres@localhost:5432/ops_test');

const urlWithPool = testDbUrl.includes('connection_limit')
  ? testDbUrl
  : `${testDbUrl}${testDbUrl.includes('?') ? '&' : '?'}connection_limit=5`;

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/helpers/setup.ts'],
    env: {
      DATABASE_URL: urlWithPool,
      JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters-long-for-testing',
      JWT_EXPIRES_IN: '24h',
      NODE_ENV: 'test',
      PORT: '3001',
      CORS_ORIGIN: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
    },
  },
});
