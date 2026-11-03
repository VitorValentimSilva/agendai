import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/agendai_test?schema=public';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Os arquivos compartilham o mesmo banco: rodar em série evita interferência.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'e2e-secret',
      CRON_SECRET: 'e2e-cron-secret',
      WEB_ORIGIN: 'http://localhost:3000',
      THROTTLE_LIMIT: '10000',
      BOOKING_THROTTLE_LIMIT: '10000',
    },
  },
});
