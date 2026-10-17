const db = require('../config/database');
const { escapeLike } = require('../utils/helpers');

// translations + tags are loaded with subqueries, so a list of 20 items is still 1 query (no N+1)
const SELECT_FIELDS = `
  tk.id, tk.key, tk.description, tk.created_at, tk.updated_at,
  COALESCE((
    SELECT json_object_agg(l.code, tr.value ORDER BY l.code)
    FROM translations tr
    JOIN locales l ON l.id = tr.locale_id
    WHERE tr.translation_key_id = tk.id
  ), '{}') AS translations,
  COALESCE((
    SELECT json_agg(t.name ORDER BY t.name)
    FROM translation_key_tags ktt
    JOIN tags t ON t.id = ktt.tag_id
    WHERE ktt.translation_key_id = tk.id
  ), '[]') AS tags
`;

class TranslationRepository {
  async findById(id) {
    const { rows } = await db.query(
      `SELECT ${SELECT_FIELDS} FROM translation_keys tk WHERE tk.id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  async findByKey(key) {
    const { rows } = await db.query('SELECT id, key FROM translation_keys WHERE key = $1', [key]);
    return rows[0] || null;
  }

  async search({ key, content, tags, localeId, page, limit }) {
    const conditions = [];
    const params = [];

    if (key) {
      params.push(`%${escapeLike(key)}%`);
      conditions.push(`tk.key ILIKE $${params.length}`);
    }

    if (tags && tags.length) {
      params.push(tags);
      conditions.push(`tk.id IN (
        SELECT ktt.translation_key_id FROM translation_key_tags ktt
        JOIN tags t ON t.id = ktt.tag_id
        WHERE t.name = ANY($${params.length})
      )`);
    }

    if (content) {
      params.push(`%${escapeLike(content)}%`);
      let subQuery = `SELECT tr.translation_key_id FROM translations tr WHERE tr.value ILIKE $${params.length}`;
      if (localeId) {
        params.push(localeId);
        subQuery += ` AND tr.locale_id = $${params.length}`;
      }
      conditions.push(`tk.id IN (${subQuery})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [countResult, listResult] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM translation_keys tk ${where}`, params),
      db.query(
        `SELECT ${SELECT_FIELDS}
         FROM (
           SELECT * FROM translation_keys tk ${where}
           ORDER BY tk.id
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}
         ) tk
         ORDER BY tk.id`,
        [...params, limit, offset],
      ),
    ]);

    return { rows: listResult.rows, total: countResult.rows[0].total };
  }

  async createKey({ key, description }, client) {
    const { rows } = await client.query(
      'INSERT INTO translation_keys (key, description) VALUES ($1, $2) RETURNING id',
      [key, description || null],
    );
    return rows[0].id;
  }

  async updateKey(id, { key, description }, client) {
    const fields = ['updated_at = NOW()'];
    const params = [id];

    if (key !== undefined) {
      params.push(key);
      fields.push(`key = $${params.length}`);
    }
    if (description !== undefined) {
      params.push(description || null); // same as createKey, empty string is saved as null
      fields.push(`description = $${params.length}`);
    }

    await client.query(`UPDATE translation_keys SET ${fields.join(', ')} WHERE id = $1`, params);
  }

  async deleteKey(id) {
    const { rowCount } = await db.query('DELETE FROM translation_keys WHERE id = $1', [id]);
    return rowCount > 0;
  }

  // values = [{ localeId, value }]
  // one query for all locales instead of a loop, updates the value if it already exists
  async upsertValues(keyId, values, client) {
    await client.query(
      `INSERT INTO translations (translation_key_id, locale_id, value)
       SELECT $1, v.locale_id, v.value
       FROM UNNEST($2::int[], $3::text[]) AS v(locale_id, value)
       ON CONFLICT (translation_key_id, locale_id)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [keyId, values.map((v) => v.localeId), values.map((v) => v.value)],
    );
  }

  async deleteValues(keyId, localeIds, client) {
    await client.query(
      'DELETE FROM translations WHERE translation_key_id = $1 AND locale_id = ANY($2)',
      [keyId, localeIds],
    );
  }

  async syncTags(keyId, tagIds, client) {
    await client.query(
      'DELETE FROM translation_key_tags WHERE translation_key_id = $1 AND tag_id <> ALL($2::int[])',
      [keyId, tagIds],
    );
    if (tagIds.length) {
      await client.query(
        `INSERT INTO translation_key_tags (translation_key_id, tag_id)
         SELECT $1, UNNEST($2::int[])
         ON CONFLICT DO NOTHING`,
        [keyId, tagIds],
      );
    }
  }

  async getVersion() {
    const { rows } = await db.query("SELECT version FROM cache_versions WHERE name = 'translations'");
    return rows[0].version;
  }

  // json is built by postgres itself (json_object_agg), much faster than looping 100k rows in node
  async getExportJson(localeId, tags) {
    const params = [localeId];
    let tagFilter = '';

    if (tags.length) {
      params.push(tags);
      tagFilter = `AND tk.id IN (
        SELECT ktt.translation_key_id FROM translation_key_tags ktt
        JOIN tags t ON t.id = ktt.tag_id
        WHERE t.name = ANY($2)
      )`;
    }

    // COLLATE "C" makes the sort ~2x faster, we don't need language aware sorting for keys
    const { rows } = await db.query(
      `SELECT COALESCE(json_object_agg(tk.key, tr.value ORDER BY tk.key COLLATE "C"), '{}')::text AS json
       FROM translations tr
       JOIN translation_keys tk ON tk.id = tr.translation_key_id
       WHERE tr.locale_id = $1 ${tagFilter}`,
      params,
    );
    return rows[0].json;
  }
}

module.exports = new TranslationRepository();
