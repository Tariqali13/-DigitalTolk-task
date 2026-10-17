const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, db, resetDatabase } = require('../helpers');

describe('Auth API', () => {
  const user = { name: 'Ali Khan', email: 'Ali@Example.com', password: 'password123' };

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await db.pool.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a user and return a token', async () => {
      const res = await request(app).post('/api/v1/auth/register').send(user);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({ name: 'Ali Khan', email: 'ali@example.com' });
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeDefined();
    });

    it('should store a hashed password', async () => {
      await request(app).post('/api/v1/auth/register').send(user);
      const { rows } = await db.query('SELECT password FROM users');

      expect(rows[0].password).not.toBe(user.password);
      expect(rows[0].password).toMatch(/^\$2[ab]\$/);
    });

    it('should not allow the same email twice', async () => {
      await request(app).post('/api/v1/auth/register').send(user);
      const res = await request(app).post('/api/v1/auth/register').send(user);

      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Email already exists');
    });

    it('should validate the input', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'wrong-email', password: '123' });

      expect(res.status).toBe(422);
      expect(res.body.errors.map((e) => e.field).sort()).toEqual(['email', 'name', 'password']);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(user);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ali@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ali@example.com', password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('should fail with unknown email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return the logged in user', async () => {
      const register = await request(app).post('/api/v1/auth/register').send(user);
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${register.body.data.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('ali@example.com');
    });

    it('should return 404 if the user was deleted', async () => {
      const token = jwt.sign({ id: 9999, email: 'ghost@test.com' }, process.env.JWT_SECRET);
      const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('auth middleware', () => {
    it('should reject requests without a token', async () => {
      const res = await request(app).get('/api/v1/translations');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Unauthorized, token not provided');
    });

    it('should reject a wrong auth scheme', async () => {
      const res = await request(app).get('/api/v1/translations').set('Authorization', 'Basic abc');
      expect(res.status).toBe(401);
    });

    it('should reject an invalid token', async () => {
      const res = await request(app).get('/api/v1/translations').set('Authorization', 'Bearer abc.def.ghi');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid token');
    });

    it('should reject an expired token', async () => {
      const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -10 });
      const res = await request(app).get('/api/v1/translations').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token expired, please login again');
    });
  });
});
