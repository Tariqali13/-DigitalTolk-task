const crypto = require('crypto');
const translationRepository = require('../repositories/translation.repository');
const localeRepository = require('../repositories/locale.repository');
const ApiError = require('../utils/ApiError');

// simple in-memory cache, one entry per locale + tags combination
// TODO: move to redis if we run many instances (it works now, but each instance builds its own copy)
const MAX_CACHE_ITEMS = 100;

class ExportService {
  constructor() {
    this.cache = new Map();
  }

  async exportLocale(localeCode, tags = []) {
    const locale = await localeRepository.findByCode(localeCode);
    if (!locale) {
      throw new ApiError(404, `Locale '${localeCode}' not found`);
    }

    // NOTE: version is read before the data. if something changes in between, the next
    // request will see a new version and rebuild, so old data is never returned
    const version = await translationRepository.getVersion();
    const cacheKey = `${locale.id}:${[...tags].sort().join(',')}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.version === version) {
      // move it to the end of the map so it counts as recently used
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    const json = await translationRepository.getExportJson(locale.id, tags);
    const hash = crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 8);
    const result = { version, json, etag: `"${version}-${hash}"` };

    // cache is full -> remove the least recently used entry (first one in the map)
    if (!this.cache.has(cacheKey) && this.cache.size >= MAX_CACHE_ITEMS) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, result);

    return result;
  }
}

module.exports = new ExportService();
