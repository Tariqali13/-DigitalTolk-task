jest.mock('dotenv', () => ({ config: jest.fn() }));

describe('config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('should use default values', () => {
    delete process.env.PORT;
    delete process.env.CDN_MAX_AGE;
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.DB_POOL_SIZE;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
    const config = require('../../src/config');

    expect(config.port).toBe(3000);
    expect(config.cdnMaxAge).toBe(0);
    expect(config.env).toBe('development');
    expect(config.db).toEqual({ url: 'postgres://tms:tms@localhost:5433/tms', poolSize: 20 });
    expect(config.jwt).toEqual({ secret: 'local-dev-secret', expiresIn: '1d' });
  });

  it('should read values from env', () => {
    process.env.PORT = '8080';
    process.env.CDN_MAX_AGE = '60';
    const config = require('../../src/config');

    expect(config.port).toBe(8080);
    expect(config.cdnMaxAge).toBe(60);
  });

  it('should throw in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    expect(() => require('../../src/config')).toThrow('JWT_SECRET is required in production');
  });
});
