/**
 * Vitest global setup. Keeps test runs hermetic:
 *  - Pin NODE_ENV=test so production guards don't kick in
 *  - Provide deterministic JWT + DB placeholders so `env.ts` doesn't blow up
 *    when .env is missing on CI.
 */
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db'
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh'
