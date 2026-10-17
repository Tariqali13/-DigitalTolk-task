-- The export endpoint keeps the generated json in memory. To know when that cache is old
-- I keep a version number here which the triggers below increase on every insert/update/delete.
-- Did it in the db and not in the app so it also works when data is changed by the seeder
-- or when more than one instance of the app is running.
CREATE TABLE cache_versions (
  name    VARCHAR(50) PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 1
);

INSERT INTO cache_versions (name) VALUES ('translations');

CREATE OR REPLACE FUNCTION bump_translations_version() RETURNS TRIGGER AS $$
BEGIN
  UPDATE cache_versions SET version = version + 1 WHERE name = 'translations';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- FOR EACH STATEMENT (not each row) so the seeder's bulk insert bumps it once and not 100k times
CREATE TRIGGER trg_translations_version
  AFTER INSERT OR UPDATE OR DELETE ON translations
  FOR EACH STATEMENT EXECUTE FUNCTION bump_translations_version();

CREATE TRIGGER trg_translation_keys_version
  AFTER INSERT OR UPDATE OR DELETE ON translation_keys
  FOR EACH STATEMENT EXECUTE FUNCTION bump_translations_version();

CREATE TRIGGER trg_translation_key_tags_version
  AFTER INSERT OR UPDATE OR DELETE ON translation_key_tags
  FOR EACH STATEMENT EXECUTE FUNCTION bump_translations_version();
