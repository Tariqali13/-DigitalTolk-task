const request = require('supertest');
const config = require('../../src/config');
const { app, db, resetDatabase, getToken, createLocales, createTranslation } = require('../helpers');

describe('Export API', () => {
  let token;

  const get = (url) => request(app).get(url).set('Authorization', `Bearer ${token}`);
  const put = (url, body) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body);

  beforeEach(async () => {
    await resetDatabase();
    token = await getToken();
    await createLocales(token);
    await createTranslation(token, { key: 'b.second', tags: ['web'], translations: { en: 'Second', fr: 'Deuxième' } });
    await createTranslation(token, { key: 'a.first', tags: ['mobile'], translations: { en: 'First' } });
  });

  afterAll(async () => {
    await db.pool.end();
  });

  it('should export a flat key/value json sorted by key', async () => {
    const res = await get('/api/v1/export/en');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ 'a.first': 'First', 'b.second': 'Second' });
    expect(Object.keys(res.body)).toEqual(['a.first', 'b.second']);
  });

  it('should export only the given locale', async () => {
    const res = await get('/api/v1/export/fr');
    expect(res.body).toEqual({ 'b.second': 'Deuxième' });
  });

  it('should filter by tags', async () => {
    const res = await get('/api/v1/export/en?tags=mobile');
    expect(res.body).toEqual({ 'a.first': 'First' });
  });

  it('should return an empty object for a locale without translations', async () => {
    const res = await get('/api/v1/export/es');
    expect(res.body).toEqual({});
  });

  it('should always return the latest data', async () => {
    await get('/api/v1/export/en');

    const created = await createTranslation(token, { key: 'c.third', translations: { en: 'Third' } });
    let res = await get('/api/v1/export/en');
    expect(res.body['c.third']).toBe('Third');

    await put(`/api/v1/translations/${created.id}`, { translations: { en: 'Third edited' } });
    res = await get('/api/v1/export/en');
    expect(res.body['c.third']).toBe('Third edited');

    await put(`/api/v1/translations/${created.id}`, { tags: ['mobile'] });
    res = await get('/api/v1/export/en?tags=mobile');
    expect(Object.keys(res.body)).toEqual(['a.first', 'c.third']);

    await request(app).delete(`/api/v1/translations/${created.id}`).set('Authorization', `Bearer ${token}`);
    res = await get('/api/v1/export/en');
    expect(res.body['c.third']).toBeUndefined();
  });

  it('should return 304 when the ETag has not changed', async () => {
    const first = await get('/api/v1/export/en');
    const notModified = await get('/api/v1/export/en').set('If-None-Match', first.headers.etag);

    await createTranslation(token, { translations: { en: 'new one' } });
    const changed = await get('/api/v1/export/en').set('If-None-Match', first.headers.etag);

    expect(first.headers.etag).toBeDefined();
    expect(notModified.status).toBe(304);
    expect(changed.status).toBe(200);
  });

  it('should send cache headers for CDN', async () => {
    const res = await get('/api/v1/export/en');
    expect(res.headers['cache-control']).toBe('public, no-cache');
  });

  it('should use s-maxage when CDN_MAX_AGE is set', async () => {
    config.cdnMaxAge = 300;
    const res = await get('/api/v1/export/en');
    config.cdnMaxAge = 0;

    expect(res.headers['cache-control']).toBe('public, max-age=0, s-maxage=300');
  });

  it('should gzip the response when the client supports it', async () => {
    // compression only works for responses > 1kb, so adding a long text
    const longText = 'x'.repeat(2000);
    await createTranslation(token, { key: 'c.long', translations: { en: longText } });
    const res = await get('/api/v1/export/en').set('Accept-Encoding', 'gzip');

    expect(res.headers['content-encoding']).toBe('gzip');
    expect(res.body['c.long']).toBe(longText);
  });

  it('should return 404 for unknown locale', async () => {
    const res = await get('/api/v1/export/de');
    expect(res.status).toBe(404);
  });

  it('should return 422 for invalid tags', async () => {
    const res = await get('/api/v1/export/en?tags=bad%20tag');
    expect(res.status).toBe(422);
  });

  it('should require a token', async () => {
    const res = await request(app).get('/api/v1/export/en');
    expect(res.status).toBe(401);
  });
});
