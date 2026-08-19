process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:55432/sales_assistant_test?schema=public';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:56379';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = 'integration-test-key';
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX ?? '100000';