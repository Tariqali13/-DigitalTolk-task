// Performance tests with a big dataset (40k keys x 3 locales = 120k translations).
// Every endpoint is called 20 times and p95 must be under the limit from the assignment:
// 200ms for normal endpoints and 500ms for the json export.
const http = require('http');
const app = require('../../src/app');
const db = require('../../src/config/database');
const seedTranslations = require('../../src/database/seeders/translation.seeder');

jest.setTimeout(120000);

const KEYS = 40000;
const RUNS = 20;

let server;
let baseUrl;
let token;
const results = [];

// using plain http instead of supertest so the time is closer to a real client
function callApi(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const start = Date.now();

    const req = http.request(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody, time: Date.now() - start }));
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function measure(name, limitMs, makeRequest, runs = RUNS) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const res = await makeRequest(i);
    expect(res.status).toBeLessThan(400);
    times.push(res.time);
  }
  times.sort((a, b) => a - b);
  const avg = Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
  const p95 = times[Math.ceil(times.length * 0.95) - 1];

  results.push({ endpoint: name, 'avg (ms)': avg, 'p95 (ms)': p95, 'limit (ms)': limitMs });
  expect(p95).toBeLessThan(limitMs);
}

beforeAll(async () => {
  const start = Date.now();
  const total = await seedTranslations({ keys: KEYS });
  console.log(`Seeded ${total.keys + total.translations + total.tags} records in ${Date.now() - start}ms`);

  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const register = await callApi('POST', '/api/v1/auth/register', {
    name: 'Perf User', email: 'perf@test.com', password: 'password123',
  });
  token = JSON.parse(register.body).data.token;

  // warm up db connections first, otherwise the first calls are slower
  for (let i = 0; i < 5; i++) {
    await callApi('GET', '/api/v1/translations?content=welcome');
  }
});

afterAll(async () => {
  console.table(results);
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
});

describe(`Performance (${KEYS * 3} translations)`, () => {
  it('search by key < 200ms', async () => {
    await measure('GET /translations?key=', 200, (i) => callApi('GET', `/api/v1/translations?key=checkout.error_${i}`));
  });

  it('search by content < 200ms', async () => {
    await measure('GET /translations?content=', 200, () => callApi('GET', '/api/v1/translations?content=payment%20failed'));
  });

  it('search by tags < 200ms', async () => {
    await measure('GET /translations?tags=', 200, () => callApi('GET', '/api/v1/translations?tags=mobile,desktop'));
  });

  it('search with all filters < 200ms', async () => {
    await measure('GET /translations?tags&locale&content', 200, () =>
      callApi('GET', '/api/v1/translations?tags=mobile&locale=fr&content=securely&limit=100'));
  });

  it('far page < 200ms', async () => {
    await measure('GET /translations?page=1500', 200, (i) => callApi('GET', `/api/v1/translations?page=${1500 + i}`));
  });

  it('get by id < 200ms', async () => {
    await measure('GET /translations/:id', 200, (i) => callApi('GET', `/api/v1/translations/${100 + i}`));
  });

  it('create < 200ms', async () => {
    await measure('POST /translations', 200, (i) => callApi('POST', '/api/v1/translations', {
      key: `perf.test_${i}`,
      tags: ['web', 'perf'],
      translations: { en: 'Hello', fr: 'Bonjour', es: 'Hola' },
    }));
  });

  it('update < 200ms', async () => {
    await measure('PUT /translations/:id', 200, (i) => callApi('PUT', `/api/v1/translations/${200 + i}`, {
      translations: { en: `Updated ${i}` },
      tags: ['web'],
    }));
  });

  it('export right after a change < 500ms', async () => {
    await measure('GET /export/en (after update)', 500, async (i) => {
      const updated = await callApi('PUT', `/api/v1/translations/${300 + i}`, { translations: { en: `Changed ${i}` } });
      const { key } = JSON.parse(updated.body).data;

      const res = await callApi('GET', '/api/v1/export/en');
      expect(JSON.parse(res.body)[key]).toBe(`Changed ${i}`);
      return res;
    }, 10);
  });

  it('export (cached) < 500ms', async () => {
    await measure('GET /export/en (cached)', 500, () => callApi('GET', '/api/v1/export/en'));
  });

  it('export gzip < 500ms', async () => {
    await measure('GET /export/en (gzip)', 500, () => callApi('GET', '/api/v1/export/en', null, { 'Accept-Encoding': 'gzip' }));
  });

  it('export with tag filter < 500ms', async () => {
    await measure('GET /export/fr?tags=web', 500, () => callApi('GET', '/api/v1/export/fr?tags=web'));
  });

  it('export 304 with ETag < 500ms', async () => {
    const first = await callApi('GET', '/api/v1/export/en');
    await measure('GET /export/en (304)', 500, () =>
      callApi('GET', '/api/v1/export/en', null, { 'If-None-Match': first.headers.etag }));
  });
});
