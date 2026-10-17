const fs = require('fs');
const { db } = require('../helpers');
const runMigrations = require('../../src/database/migrate');

describe('Database', () => {
  afterAll(async () => {
    await db.pool.end();
  });

  describe('transaction', () => {
    it('should rollback everything when an error is thrown', async () => {
      await expect(
        db.transaction(async (client) => {
          await client.query("INSERT INTO tags (name) VALUES ('rollback-test')");
          throw new Error('something failed');
        }),
      ).rejects.toThrow('something failed');

      const { rows } = await db.query("SELECT * FROM tags WHERE name = 'rollback-test'");
      expect(rows).toHaveLength(0);
    });
  });

  describe('migrations', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should skip migrations that already ran', async () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      await runMigrations();
      expect(log).toHaveBeenCalledWith('Nothing to migrate');
    });

    it('should rollback a failed migration', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['999_broken.sql']);
      const realReadFileSync = fs.readFileSync;
      jest.spyOn(fs, 'readFileSync').mockImplementation((file, ...args) => {
        if (String(file).endsWith('999_broken.sql')) {
          return 'CREATE TABLE broken_table (id INT); SELECT * FROM missing_table;';
        }
        return realReadFileSync(file, ...args);
      });

      await expect(runMigrations()).rejects.toThrow('missing_table');

      const { rows } = await db.query("SELECT to_regclass('broken_table') AS name");
      expect(rows[0].name).toBeNull();
    });
  });
});
