// integration and performance tests use their own databases on the same server
const baseUrl = process.env.TEST_DATABASE_URL || 'postgres://tms:tms@localhost:5433';
const dbName = process.env.JEST_DB_NAME || 'tms_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `${baseUrl}/${dbName}`;
process.env.DB_POOL_SIZE = '5';
process.env.JWT_SECRET = 'test-secret';
