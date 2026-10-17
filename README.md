# Translation Management Service

![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Tests](https://img.shields.io/badge/tests-106%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen)

This is my solution for the **Translation Management Service** coding assignment.

It's a REST API to store translations for multiple languages, tag them by context (mobile, desktop, web),
search them, and export them as JSON for frontend apps like Vue.js. The focus of the assignment was clean
code, security and performance, so I tested everything on a database with **120,000 translations**.

![Swagger UI](docs/swagger.png)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start (Docker)](#quick-start-docker)
- [Running Without Docker](#running-without-docker)
- [Design Choices](#design-choices)
- [API Overview](#api-overview)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Performance](#performance)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Assumptions](#assumptions)
- [What I Would Improve](#what-i-would-improve)

## Features

- Translations for multiple locales (`en`, `fr`, `es` ...). New languages can be added from the API.
- Tags for context (`mobile`, `desktop`, `web` or anything else)
- Create, update, view, delete and search translations by **key**, **content** or **tags**
- JSON export per locale for frontend apps. It always returns the latest data.
- JWT authentication
- Seeder that inserts 100k+ records in a few seconds
- Swagger / OpenAPI documentation
- Docker setup
- CDN friendly export (`ETag`, `Cache-Control`, `304 Not Modified`)
- Unit, integration and performance tests (98% coverage)

## Tech Stack

| | |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Database | PostgreSQL 16, plain SQL with `pg` (no ORM, as the assignment asked) |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Validation | Joi |
| Docs | Swagger UI (`swagger-ui-express`) |
| Tests | Jest + Supertest |

## Quick Start (Docker)

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/<your-username>/translation-management-service.git
cd translation-management-service

docker compose up -d --build          # starts postgres + api, runs migrations
docker compose exec app npm run seed  # optional: 120k translations + test user
```

That's it:

- API: http://localhost:3000/api/v1
- Swagger docs: http://localhost:3000/api-docs
- Test user (created by the seeder): `admin@example.com` / `password123`

In Swagger, call `POST /auth/login`, copy the token, click **Authorize** and paste it.

To stop everything: `docker compose down` (add `-v` to delete the database too).

## Running Without Docker

Requirements: Node.js 20+ and PostgreSQL 13+.

```bash
npm install
cp .env.example .env        # change DATABASE_URL if your postgres is different
docker compose up -d db     # or use your own postgres
npm run migrate
npm run seed                # 40k keys x 3 locales = 120k translations
npm run dev                 # http://localhost:3000
```

The seeder can make more or less data:

```bash
npm run seed -- --keys=100000 --locales=en,fr,es,de
```

## Design Choices

A short summary of the main decisions. The sections below go into more detail.

| Decision | Why |
|----------|-----|
| **Layers: routes → controllers → services → repositories** | Each layer does one thing (SOLID). Services hold the business logic and can be unit tested by mocking the repositories. |
| **Plain SQL with `pg`, no ORM** | The assignment said no CRUD libraries. It also gave me full control over the queries that matter for speed (`json_object_agg`, bulk `UNNEST` upserts, trigram search). |
| **Locales as rows, not columns** | Adding a new language is an insert, with no migration or code change. |
| **Tags on the translation key, not per locale** | "mobile" or "web" context is the same in every language, so tagging each translation separately would just duplicate data. |
| **`pg_trgm` GIN indexes** | Search uses `ILIKE '%text%'`, which a normal index can't help with. Trigram indexes keep it fast on 100k+ rows. |
| **Export JSON built inside Postgres** | `json_object_agg` returns the whole `{ key: value }` object as one string, so Node doesn't build 40k objects on every request. |
| **Export cache with a DB version counter** | The export must always be up to date. Triggers bump a version on every change; the app rebuilds the cached JSON only when the version changed. Unlike clearing the cache in code, this also works with the seeder and with multiple app instances. |
| **ETag + `Cache-Control` on the export** | Lets a CDN or browser cache it. Unchanged data is answered with `304` in 1–2 ms. |
| **JWT + bcrypt** | Stateless auth, so no session lookup per request. Login always runs bcrypt (with a dummy hash for unknown emails) so response time doesn't reveal which emails exist. |
| **Joi validation in middleware** | Bad input is rejected with a clear `422` before it reaches the controller. |
| **Page/limit pagination with total** | Easy for a frontend to build page numbers. Still fast at this size (page 1500 in ~6 ms). |
| **Seeder using `generate_series`** | Generating rows inside Postgres inserts 210k records in ~8 seconds; inserting them one by one from Node would take minutes. |

## API Overview

Base URL: `/api/v1`. Every endpoint except register and login needs `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register a user |
| POST | `/auth/login` | Login, returns a JWT token |
| GET | `/auth/me` | Logged in user |
| GET | `/locales` | List locales |
| POST | `/locales` | Add a new locale |
| GET | `/tags` | List tags |
| POST | `/tags` | Add a tag |
| GET | `/translations` | Search translations |
| POST | `/translations` | Create a translation |
| GET | `/translations/:id` | Get one translation |
| PUT | `/translations/:id` | Update a translation |
| DELETE | `/translations/:id` | Delete a translation |
| GET | `/export/:locale` | Export a locale as JSON |

Full details with request and response examples are in Swagger (`/api-docs`).

### Create a translation

```bash
curl -X POST http://localhost:3000/api/v1/translations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "auth.login.title",
    "description": "Login page title",
    "tags": ["web", "mobile"],
    "translations": { "en": "Sign in", "fr": "Se connecter" }
  }'
```

```json
{
  "success": true,
  "message": "Translation created successfully",
  "data": {
    "id": 1,
    "key": "auth.login.title",
    "description": "Login page title",
    "translations": { "en": "Sign in", "fr": "Se connecter" },
    "tags": ["mobile", "web"],
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### Update

Only send what you want to change. Set a locale to `null` to remove it.

```json
PUT /api/v1/translations/1
{ "translations": { "en": "Log in", "fr": null }, "tags": ["web"] }
```

### Search

All filters are optional. `tags` matches any of the given tags.

```
GET /api/v1/translations?key=auth&content=sign&tags=web,mobile&locale=en&page=1&limit=20
```

```json
{
  "success": true,
  "message": "Translations fetched successfully",
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

### Export

```
GET /api/v1/export/en
GET /api/v1/export/en?tags=web
```

```json
{
  "auth.login.title": "Sign in",
  "cart.empty": "Your cart is empty"
}
```

Using it in Vue with vue-i18n:

```js
const messages = { en: await fetch('/api/v1/export/en', { headers }).then((r) => r.json()) };
const i18n = createI18n({ locale: 'en', flatJson: true, messages });
```

## Project Structure

```
src/
├── config/          # env config and database connection
├── controllers/     # read the request, send the response
├── services/        # business logic
├── repositories/    # SQL queries
├── routes/
├── middlewares/     # auth, validation, error handling
├── validations/     # Joi schemas
├── database/        # migrations, migration runner, seeder
├── docs/            # swagger.yaml
├── utils/
├── app.js
└── server.js
tests/
├── unit/
├── integration/
└── performance/
```

```mermaid
flowchart LR
    A[Request] --> B[Route]
    B --> C[Auth + Joi validation]
    C --> D[Controller]
    D --> E[Service]
    E --> F[Repository]
    F --> G[(PostgreSQL)]
```

I tried to keep each layer doing one thing (SOLID). Controllers only deal with req/res, services have the
business logic and repositories have the SQL. This also made the services easy to unit test, because I
can just mock the repositories.

## Database Design

```mermaid
erDiagram
    locales ||--o{ translations : has
    translation_keys ||--o{ translations : has
    translation_keys ||--o{ translation_key_tags : has
    tags ||--o{ translation_key_tags : has

    locales {
        int id PK
        varchar code UK
        varchar name
    }
    translation_keys {
        bigint id PK
        varchar key UK
        text description
    }
    translations {
        bigint id PK
        bigint translation_key_id FK
        int locale_id FK
        text value
    }
    tags {
        int id PK
        varchar name UK
    }
    translation_key_tags {
        bigint translation_key_id PK
        int tag_id PK
    }
```

- **locales**: one row per language, so adding a language doesn't change the schema
- **translation_keys**: the key, e.g. `auth.login.title`
- **translations**: the value of a key for one locale (unique per key + locale)
- **tags** and **translation_key_tags**: many-to-many between keys and tags
- **users**: for login
- **cache_versions**: a counter used by the export cache (explained below)

I put tags on the key and not on each translation. If `auth.login.title` is shown on mobile, it's shown on
mobile in every language, so there's no point tagging en/fr/es separately.

**Indexes:**
- `pg_trgm` GIN indexes on `translation_keys.key` and `translations.value`, so `ILIKE '%text%'` search
  doesn't scan the whole table
- `translations(locale_id, translation_key_id)` for the export
- `translation_key_tags(tag_id, translation_key_id)` for tag filters

## Performance

The assignment asks for **< 200ms** on all endpoints and **< 500ms** for the export. Here's what I did:

- **No N+1 queries.** Search returns translations and tags with subqueries in the same SQL query.
- **Bulk upsert.** Saving the values of all locales is one query (`UNNEST` + `ON CONFLICT`).
- **JSON built by Postgres.** The export uses `json_object_agg`, so Node doesn't loop over 40k rows.
- **Export cache that's never stale.** The tricky part was that the export must *always* return updated
  data, so I couldn't cache it for X minutes. Postgres triggers increase a version number on every change
  to the translation tables. On each request the app reads that version (one small query) and only
  rebuilds the JSON when it changed. This also works when data is changed by the seeder or by another
  instance of the app.
- **Gzip** on all responses.

### CDN

The export sends `ETag` and `Cache-Control`, so it can sit behind Cloudflare, CloudFront etc.

- Default `Cache-Control: public, no-cache`: the CDN caches it but checks with the server every time.
  If nothing changed the server answers `304` in 1–2 ms.
- `CDN_MAX_AGE=60` lets the CDN serve the file for 60 seconds without asking the server.

### Results

`npm run test:performance` with **120,000 translations** (MacBook, Postgres in Docker). Each endpoint is
called 20 times; p95 means 95% of requests were faster than this.

| Endpoint | avg | p95 | limit |
|----------|-----|-----|-------|
| GET /translations?key= | 4 ms | 5 ms | 200 ms |
| GET /translations?content= | 21 ms | 24 ms | 200 ms |
| GET /translations?tags= | 58 ms | 61 ms | 200 ms |
| GET /translations (tags + locale + content) | 58 ms | 63 ms | 200 ms |
| GET /translations?page=1500 | 5 ms | 6 ms | 200 ms |
| GET /translations/:id | 2 ms | 2 ms | 200 ms |
| POST /translations | 6 ms | 8 ms | 200 ms |
| PUT /translations/:id | 8 ms | 9 ms | 200 ms |
| GET /export/en right after an update (2.3 MB) | 68 ms | 88 ms | 500 ms |
| GET /export/en cached | 4 ms | 7 ms | 500 ms |
| GET /export/en gzip | 16 ms | 19 ms | 500 ms |
| GET /export/en 304 Not Modified | 1 ms | 2 ms | 500 ms |

Every response also has an `X-Response-Time` header.

## Testing

Tests need Postgres running (`docker compose up -d db`). They create their own databases (`tms_test`,
`tms_perf`), so your dev data isn't touched.

```bash
npm test                   # unit + integration tests with coverage
npm run test:unit
npm run test:integration
npm run test:performance   # seeds 120k translations and checks response times
npm run lint
```

- **Unit tests:** services with mocked repositories, middlewares, config
- **Integration tests:** every endpoint against a real database (auth, validation, search, export
  freshness, ETag/304, gzip, seeder, migrations)
- **Performance tests:** response times on 120k translations

Current coverage: **98.5% statements, 98.7% branches** (106 tests).

## Environment Variables

See `.env.example`.

| Name | Default | Description |
|------|---------|-------------|
| `PORT` | `3000` | |
| `DATABASE_URL` | `postgres://tms:tms@localhost:5433/tms` | |
| `DB_POOL_SIZE` | `20` | |
| `JWT_SECRET` | `local-dev-secret` | Required in production |
| `JWT_EXPIRES_IN` | `1d` | |
| `CDN_MAX_AGE` | `0` | Seconds the CDN can cache the export |

## Assumptions

- Locales must exist before you add values for them (the API returns 422 otherwise). Tags are created
  automatically if they don't exist.
- Tag filters match **any** of the given tags (`?tags=web,mobile` = web OR mobile).
- The export is protected with the token like the rest of the API. If the frontend needs it public, the
  export route can be moved above the auth middleware.
- The export format is flat (`"auth.login.title": "Sign in"`), not nested.

## What I Would Improve

- Rate limiting on login and register
- Refresh tokens and logout (token blacklist)
- Redis for the export cache when running many instances
- Roles (admin / translator)
- Optional nested JSON export
- CI pipeline (GitHub Actions) to run the tests on every push
