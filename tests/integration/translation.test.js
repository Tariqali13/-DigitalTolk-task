const request = require('supertest');
const {
  app, db, resetDatabase, getToken, createLocales, translationData, createTranslation,
} = require('../helpers');

describe('Translations API', () => {
  let token;

  const api = {
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  };

  beforeEach(async () => {
    await resetDatabase();
    token = await getToken();
    await createLocales(token);
  });

  afterAll(async () => {
    await db.pool.end();
  });

  describe('POST /api/v1/translations', () => {
    it('should create a translation with locales and tags', async () => {
      const res = await api.post('/api/v1/translations', {
        key: 'auth.login.title',
        description: 'Login page title',
        tags: ['web', 'Mobile', 'web'],
        translations: { en: 'Sign in', fr: 'Se connecter' },
      });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        key: 'auth.login.title',
        description: 'Login page title',
        tags: ['mobile', 'web'],
        translations: { en: 'Sign in', fr: 'Se connecter' },
      });
    });

    it('should create a translation with only a key', async () => {
      const res = await api.post('/api/v1/translations', { key: 'only.key' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ description: null, tags: [], translations: {} });
    });

    it('should not allow duplicate keys', async () => {
      await createTranslation(token, { key: 'same.key' });
      const res = await api.post('/api/v1/translations', translationData({ key: 'same.key' }));

      expect(res.status).toBe(409);
    });

    it('should reject unknown locales and save nothing', async () => {
      const res = await api.post('/api/v1/translations', translationData({ translations: { de: 'Hallo' } }));
      const { rows } = await db.query('SELECT COUNT(*) FROM translation_keys');

      expect(res.status).toBe(422);
      expect(res.body.message).toContain('Locale not found: de');
      expect(rows[0].count).toBe(0);
    });

    it.each([
      [{ key: 'has spaces' }, 'key'],
      [{ key: 'ok', tags: 'web' }, 'tags'],
      [{ key: 'ok', tags: ['bad tag'] }, 'tags.0'],
      [{ key: 'ok', translations: { en: 123 } }, 'translations.en'],
      [{ key: 'ok', translations: { 'not valid': 'x' } }, 'translations.not valid'],
    ])('should validate %j', async (body, field) => {
      const res = await api.post('/api/v1/translations', body);

      expect(res.status).toBe(422);
      expect(res.body.errors[0].field).toBe(field);
    });
  });

  describe('GET /api/v1/translations/:id', () => {
    it('should return a translation', async () => {
      const translation = await createTranslation(token);
      const res = await api.get(`/api/v1/translations/${translation.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(translation);
    });

    it('should return 404 when not found', async () => {
      const res = await api.get('/api/v1/translations/99999');
      expect(res.status).toBe(404);
    });

    it('should return 422 for an invalid id', async () => {
      const res = await api.get('/api/v1/translations/abc');
      expect(res.status).toBe(422);
    });
  });

  describe('PUT /api/v1/translations/:id', () => {
    it('should update key and description', async () => {
      const translation = await createTranslation(token);
      const res = await api.put(`/api/v1/translations/${translation.id}`, {
        key: 'new.key',
        description: null,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ key: 'new.key', description: null });
      expect(res.body.data.translations).toEqual(translation.translations);
    });

    it('should save an empty description as null, same as create', async () => {
      const created = await api.post('/api/v1/translations', translationData({ description: '' }));
      const updated = await api.put(`/api/v1/translations/${created.body.data.id}`, { description: '' });

      expect(created.body.data.description).toBeNull();
      expect(updated.body.data.description).toBeNull();
    });

    it('should add, update and remove locale values', async () => {
      const translation = await createTranslation(token, { translations: { en: 'Hello', fr: 'Bonjour' } });
      const res = await api.put(`/api/v1/translations/${translation.id}`, {
        translations: { en: 'Hi', es: 'Hola', fr: null },
      });

      expect(res.body.data.translations).toEqual({ en: 'Hi', es: 'Hola' });
    });

    it('should replace tags', async () => {
      const translation = await createTranslation(token, { tags: ['web', 'mobile'] });

      let res = await api.put(`/api/v1/translations/${translation.id}`, { tags: ['desktop'] });
      expect(res.body.data.tags).toEqual(['desktop']);

      res = await api.put(`/api/v1/translations/${translation.id}`, { tags: [] });
      expect(res.body.data.tags).toEqual([]);
    });

    it('should keep the same key when updating with its own key', async () => {
      const translation = await createTranslation(token);
      const res = await api.put(`/api/v1/translations/${translation.id}`, { key: translation.key });

      expect(res.status).toBe(200);
    });

    it('should not allow renaming to an existing key', async () => {
      const first = await createTranslation(token);
      const second = await createTranslation(token);
      const res = await api.put(`/api/v1/translations/${second.id}`, { key: first.key });

      expect(res.status).toBe(409);
    });

    it('should require at least one field', async () => {
      const translation = await createTranslation(token);
      const res = await api.put(`/api/v1/translations/${translation.id}`, {});

      expect(res.status).toBe(422);
    });

    it('should return 404 when not found', async () => {
      const res = await api.put('/api/v1/translations/99999', { description: 'test' });
      expect(res.status).toBe(404);
    });

    it('should reject unknown locales', async () => {
      const translation = await createTranslation(token);
      const res = await api.put(`/api/v1/translations/${translation.id}`, { translations: { de: 'Hallo' } });

      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/v1/translations/:id', () => {
    it('should delete the key with all its translations', async () => {
      const translation = await createTranslation(token);

      const res = await api.delete(`/api/v1/translations/${translation.id}`);
      const { rows } = await db.query('SELECT COUNT(*) FROM translations');

      expect(res.status).toBe(200);
      expect(rows[0].count).toBe(0);
      expect((await api.get(`/api/v1/translations/${translation.id}`)).status).toBe(404);
    });

    it('should return 404 when not found', async () => {
      const res = await api.delete('/api/v1/translations/99999');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/translations (search)', () => {
    beforeEach(async () => {
      await createTranslation(token, { key: 'auth.login.title', tags: ['web'], translations: { en: 'Sign in', fr: 'Se connecter' } });
      await createTranslation(token, { key: 'auth.logout.button', tags: ['mobile'], translations: { en: 'Sign out', fr: 'Déconnexion' } });
      await createTranslation(token, { key: 'cart.empty', tags: ['web', 'desktop'], translations: { en: 'Your cart is empty', fr: 'Votre panier est vide' } });
      await createTranslation(token, { key: 'promo.banner', tags: [], translations: { en: '100% off today' } });
    });

    const keys = (res) => res.body.data.map((t) => t.key);

    it('should list all translations with pagination info', async () => {
      const res = await api.get('/api/v1/translations');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.pagination).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
    });

    it('should search by key', async () => {
      const res = await api.get('/api/v1/translations?key=AUTH.');
      expect(keys(res)).toEqual(['auth.login.title', 'auth.logout.button']);
    });

    it('should search by content', async () => {
      const res = await api.get('/api/v1/translations?content=sign');
      expect(keys(res)).toEqual(['auth.login.title', 'auth.logout.button']);
    });

    it('should search content in one locale only', async () => {
      const fr = await api.get('/api/v1/translations?content=panier&locale=fr');
      const en = await api.get('/api/v1/translations?content=panier&locale=en');

      expect(keys(fr)).toEqual(['cart.empty']);
      expect(keys(en)).toEqual([]);
    });

    it('should search by tags', async () => {
      const res = await api.get('/api/v1/translations?tags=mobile,desktop');
      expect(keys(res)).toEqual(['auth.logout.button', 'cart.empty']);
    });

    it('should combine filters', async () => {
      const res = await api.get('/api/v1/translations?tags=web&content=sign');
      expect(keys(res)).toEqual(['auth.login.title']);
    });

    it('should treat % and _ as normal characters', async () => {
      const percent = await api.get('/api/v1/translations?content=100%25');
      const underscore = await api.get('/api/v1/translations?content=100_');

      expect(keys(percent)).toEqual(['promo.banner']);
      expect(keys(underscore)).toEqual([]);
    });

    it('should paginate', async () => {
      const res = await api.get('/api/v1/translations?page=2&limit=3');

      expect(keys(res)).toEqual(['promo.banner']);
      expect(res.body.pagination).toEqual({ page: 2, limit: 3, total: 4, totalPages: 2 });
    });

    it('should return 422 for unknown locale', async () => {
      const res = await api.get('/api/v1/translations?content=x&locale=de');
      expect(res.status).toBe(422);
    });

    it.each(['limit=0', 'limit=101', 'page=0', 'tags=bad%20tag', 'locale=!!'])(
      'should validate query %s',
      async (query) => {
        const res = await api.get(`/api/v1/translations?${query}`);
        expect(res.status).toBe(422);
      },
    );
  });
});
