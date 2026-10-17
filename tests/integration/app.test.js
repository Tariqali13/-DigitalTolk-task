const request = require('supertest');
const { app, db } = require('../helpers');

describe('App', () => {
  afterAll(async () => {
    await db.pool.end();
  });

  it('GET /health should return OK', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Server is up and running' });
    expect(res.headers['x-response-time']).toBeDefined();
  });

  it('should serve swagger docs', async () => {
    const res = await request(app).get('/api-docs/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/something');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route not found');
  });

  it('should return 400 for invalid JSON', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid JSON body');
  });
});
