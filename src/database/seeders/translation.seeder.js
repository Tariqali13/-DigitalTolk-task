const db = require('../../config/database');

const LOCALE_NAMES = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
  ur: 'Urdu',
};
const TAGS = ['mobile', 'desktop', 'web'];

// Data is generated inside postgres with generate_series. Inserting 100k+ rows one by one
// from node takes way too long, this way it's ~8 sec for 210k rows.
// Each batch inserts keys, their translations for every locale and tags in one query.
const insertBatchSql = `
  WITH new_keys AS (
    INSERT INTO translation_keys (key, description)
    SELECT
      (ARRAY['auth','home','profile','settings','checkout','cart','orders','search','notifications','help'])[1 + n % 10]
        || '.' || (ARRAY['title','subtitle','button','label','placeholder','error','hint','tooltip'])[1 + (n / 10) % 8]
        || '_' || n,
      'Seeded key ' || n
    FROM generate_series($1::int, $2::int) AS n
    ON CONFLICT (key) DO NOTHING
    RETURNING id
  ),
  new_translations AS (
    INSERT INTO translations (translation_key_id, locale_id, value)
    SELECT k.id, l.id,
      '[' || l.code || '] '
        || (ARRAY['Welcome','Sign in','Your cart','Save changes','Order history','Search results','Try again','Learn more','Payment failed','Notifications'])[1 + k.id % 10]
        || ' ' || (ARRAY['now','today','securely','quickly','for free','again','here','below'])[1 + (k.id / 10) % 8]
        || ' #' || k.id
    FROM new_keys k
    CROSS JOIN locales l
    WHERE l.code = ANY($3)
    RETURNING id
  ),
  new_tags AS (
    INSERT INTO translation_key_tags (translation_key_id, tag_id)
    SELECT k.id, t.id
    FROM new_keys k
    JOIN tags t ON t.name = ($4::varchar[])[1 + k.id % 3]
      OR (k.id % 4 = 0 AND t.name = ($4::varchar[])[1 + (k.id + 1) % 3])
    RETURNING translation_key_id
  )
  SELECT
    (SELECT COUNT(*) FROM new_keys) AS keys,
    (SELECT COUNT(*) FROM new_translations) AS translations,
    (SELECT COUNT(*) FROM new_tags) AS tags
`;

async function seedTranslations({ keys = 40000, locales = ['en', 'fr', 'es'], batchSize = 10000, onBatch }) {
  for (const code of locales) {
    await db.query(
      'INSERT INTO locales (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING',
      [code, LOCALE_NAMES[code] || code],
    );
  }
  await db.query('INSERT INTO tags (name) SELECT UNNEST($1::varchar[]) ON CONFLICT DO NOTHING', [TAGS]);

  // start from the last id, so running the seeder again adds new keys instead of skipping all of them
  const { rows } = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS start FROM translation_keys');
  const start = rows[0].start;
  const end = start + keys - 1;
  const total = { keys: 0, translations: 0, tags: 0 };

  for (let from = start; from <= end; from += batchSize) {
    const to = Math.min(from + batchSize - 1, end);
    const result = await db.query(insertBatchSql, [from, to, locales, TAGS]);
    total.keys += result.rows[0].keys;
    total.translations += result.rows[0].translations;
    total.tags += result.rows[0].tags;
    if (onBatch) onBatch(total);
  }

  await db.query('ANALYZE translation_keys, translations, translation_key_tags');
  return total;
}

module.exports = seedTranslations;
