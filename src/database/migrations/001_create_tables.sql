-- needed for the trigram indexes at the bottom (fast LIKE '%text%' search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- languages are rows, so adding a new language is just an insert (no schema change)
CREATE TABLE locales (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE translation_keys (
  id          BIGSERIAL PRIMARY KEY,
  key         VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE translations (
  id                 BIGSERIAL PRIMARY KEY,
  translation_key_id BIGINT NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  locale_id          INT NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
  value              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (translation_key_id, locale_id)
);

-- tags are on key level and not per translation, because if a key is used on mobile
-- it's used on mobile in every language
CREATE TABLE translation_key_tags (
  translation_key_id BIGINT NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  tag_id             INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (translation_key_id, tag_id)
);

CREATE INDEX idx_translations_locale ON translations(locale_id, translation_key_id);
CREATE INDEX idx_key_tags_tag ON translation_key_tags(tag_id, translation_key_id);

-- without these, search with ILIKE '%text%' does a full table scan (slow with 100k+ rows)
CREATE INDEX idx_translation_keys_key_trgm ON translation_keys USING gin (key gin_trgm_ops);
CREATE INDEX idx_translations_value_trgm ON translations USING gin (value gin_trgm_ops);
