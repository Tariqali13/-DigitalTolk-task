const db = require('../config/database');

class LocaleRepository {
  async findAll() {
    const { rows } = await db.query('SELECT id, code, name FROM locales ORDER BY code');
    return rows;
  }

  async findByCode(code) {
    const { rows } = await db.query('SELECT id, code, name FROM locales WHERE code = $1', [code]);
    return rows[0] || null;
  }

  async findByCodes(codes) {
    const { rows } = await db.query(
      'SELECT id, code, name FROM locales WHERE code = ANY($1)',
      [codes],
    );
    return rows;
  }

  async create({ code, name }) {
    const { rows } = await db.query(
      'INSERT INTO locales (code, name) VALUES ($1, $2) RETURNING id, code, name',
      [code, name],
    );
    return rows[0];
  }
}

module.exports = new LocaleRepository();
