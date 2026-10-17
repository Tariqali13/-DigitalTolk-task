// npm run seed                                   -> 40k keys x 3 locales = 120k translations
// npm run seed -- --keys=100000 --locales=en,fr,es,de   -> custom amount
const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/database');
const runMigrations = require('./migrate');
const seedTranslations = require('./seeders/translation.seeder');

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);

async function seed() {
  await runMigrations();

  console.log('Seeding translations, please wait...');
  const startTime = Date.now();
  const total = await seedTranslations({
    keys: parseInt(args.keys, 10) || 40000,
    locales: args.locales ? args.locales.split(',') : ['en', 'fr', 'es'],
    onBatch: (t) => console.log(`  ${t.keys} keys, ${t.translations} translations, ${t.tags} tag links`),
  });

  const seconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Done! Inserted ${total.keys + total.translations + total.tags} records in ${seconds}s`);

  const password = await bcrypt.hash('password123', 10);
  await query(
    `INSERT INTO users (name, email, password) VALUES ('Admin', 'admin@example.com', $1)
     ON CONFLICT (email) DO NOTHING`,
    [password],
  );
  console.log('You can login with admin@example.com / password123');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
