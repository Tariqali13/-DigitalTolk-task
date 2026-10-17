const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

const resetDatabase = () =>
  db.query(`TRUNCATE users, locales, tags, translation_keys, translations, translation_key_tags
            RESTART IDENTITY CASCADE`);

let userCount = 0;

const getToken = async () => {
  userCount += 1;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email: `user${userCount}@test.com`, password: 'password123' });
  return res.body.data.token;
};

const createLocales = async (token, locales = { en: 'English', fr: 'French', es: 'Spanish' }) => {
  for (const [code, name] of Object.entries(locales)) {
    await request(app).post('/api/v1/locales').set('Authorization', `Bearer ${token}`).send({ code, name });
  }
};

let keyCount = 0;

// simple factory for translation payloads
const translationData = (overrides = {}) => {
  keyCount += 1;
  return {
    key: `test.key_${keyCount}`,
    description: 'test translation',
    tags: ['web'],
    translations: { en: `Hello ${keyCount}`, fr: `Bonjour ${keyCount}` },
    ...overrides,
  };
};

const createTranslation = async (token, overrides) => {
  const res = await request(app)
    .post('/api/v1/translations')
    .set('Authorization', `Bearer ${token}`)
    .send(translationData(overrides));
  return res.body.data;
};

module.exports = { app, db, resetDatabase, getToken, createLocales, translationData, createTranslation };
