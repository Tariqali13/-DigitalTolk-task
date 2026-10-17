const { Pool, types } = require('pg');
const config = require('./index');

// return BIGINT columns as numbers instead of strings
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.poolSize,
});

const query = (text, params) => pool.query(text, params);

const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };
