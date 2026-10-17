const request = require('supertest');
const { app, db, resetDatabase, getToken } = require('../helpers');

describe('Locales and Tags API', () => {
  let token;

  beforeEach(async () => {
    await resetDatabase();
    token = await getToken();
  });

  afterAll(async () => {
    await db.pool.end();
  });

  const post = (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);

  describe('Locales', () => {
    it('should create and list locales', async () => {
      const created = await post('/api/v1/locales', { code: 'pt-BR', name: 'Portuguese (Brazil)' });
      await post('/api/v1/locales', { code: 'en', name: 'English' });
      const res = await get('/api/v1/locales');

      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ code: 'pt-BR', name: 'Portuguese (Brazil)' });
      expect(res.status).toBe(200);
      expect(res.body.data.map((l) => l.code)).toEqual(['en', 'pt-BR']);
    });

    it('should not create a duplicate locale', async () => {
      await post('/api/v1/locales', { code: 'en', name: 'English' });
      const res = await post('/api/v1/locales', { code: 'en', name: 'English' });

      expect(res.status).toBe(409);
    });

    it('should reject an invalid locale code', async () => {
      const res = await post('/api/v1/locales', { code: 'EN_US!', name: 'Wrong' });

      expect(res.status).toBe(422);
      expect(res.body.errors[0].field).toBe('code');
    });
  });

  describe('Tags', () => {
    it('should create and list tags in lowercase', async () => {
      await post('/api/v1/tags', { name: 'Mobile' });
      await post('/api/v1/tags', { name: 'desktop' });
      const res = await get('/api/v1/tags');

      expect(res.body.data.map((t) => t.name)).toEqual(['desktop', 'mobile']);
    });

    it('should not create a duplicate tag', async () => {
      await post('/api/v1/tags', { name: 'web' });
      const res = await post('/api/v1/tags', { name: 'web' });

      expect(res.status).toBe(409);
    });

    it('should reject an invalid tag name', async () => {
      const res = await post('/api/v1/tags', { name: 'has space' });

      expect(res.status).toBe(422);
      expect(res.body.errors[0].message).toBe('name can only contain letters, numbers, - and _');
    });
  });
});
