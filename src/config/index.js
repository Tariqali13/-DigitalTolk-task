require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

module.exports = {
  env,
  port: parseInt(process.env.PORT, 10) || 3000,
  db: {
    url: process.env.DATABASE_URL || 'postgres://tms:tms@localhost:5433/tms',
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 20,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'local-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  // how long (seconds) a CDN can cache the export. 0 = CDN has to check with us every time,
  // which is fine because we send 304 if nothing changed
  cdnMaxAge: parseInt(process.env.CDN_MAX_AGE, 10) || 0,
};
