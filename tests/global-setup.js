const { Client } = require('pg');

// creates a fresh test database and runs the migrations on it
module.exports = async (globalConfig, projectConfig) => {
  const baseUrl = process.env.TEST_DATABASE_URL || 'postgres://tms:tms@localhost:5433';
  const dbName = projectConfig.displayName.name === 'performance' ? 'tms_perf' : 'tms_test';

  const client = new Client({ connectionString: `${baseUrl}/postgres` });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await client.query(`CREATE DATABASE ${dbName}`);
  await client.end();

  process.env.JEST_DB_NAME = dbName;
  process.env.DATABASE_URL = `${baseUrl}/${dbName}`;
  const runMigrations = require('../src/database/migrate');
  const { pool } = require('../src/config/database');
  await runMigrations();
  await pool.end();
};
