const { db, resetDatabase } = require('../helpers');
const seedTranslations = require('../../src/database/seeders/translation.seeder');

describe('Translation seeder', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.pool.end();
  });

  const count = async (table) => {
    const { rows } = await db.query(`SELECT COUNT(*) FROM ${table}`);
    return rows[0].count;
  };

  it('should create keys, translations for each locale and tags', async () => {
    const onBatch = jest.fn();
    const total = await seedTranslations({ keys: 25, locales: ['en', 'fr', 'xx'], batchSize: 10, onBatch });

    expect(total.keys).toBe(25);
    expect(total.translations).toBe(75);
    expect(total.tags).toBe(await count('translation_key_tags'));
    expect(onBatch).toHaveBeenCalledTimes(3);
    expect(await count('translations')).toBe(75);
  });

  it('should add new keys when run again', async () => {
    await seedTranslations({ keys: 5 });
    await seedTranslations({ keys: 5 });

    expect(await count('translation_keys')).toBe(10);
    expect(await count('translations')).toBe(30);
  });
});
