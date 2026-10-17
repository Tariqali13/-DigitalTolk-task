const db = require('../config/database');

class TagRepository {
  async findAll() {
    const { rows } = await db.query('SELECT id, name FROM tags ORDER BY name');
    return rows;
  }

  async findByName(name) {
    const { rows } = await db.query('SELECT id, name FROM tags WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async create(name) {
    const { rows } = await db.query('INSERT INTO tags (name) VALUES ($1) RETURNING id, name', [name]);
    return rows[0];
  }

  // insert the ones that don't exist yet, then return all of them with ids
  async findOrCreate(names, client) {
    await client.query(
      'INSERT INTO tags (name) SELECT UNNEST($1::varchar[]) ON CONFLICT (name) DO NOTHING',
      [names],
    );
    const { rows } = await client.query('SELECT id, name FROM tags WHERE name = ANY($1)', [names]);
    return rows;
  }
}

module.exports = new TagRepository();
