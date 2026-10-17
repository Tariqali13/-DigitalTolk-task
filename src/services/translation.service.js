const { transaction } = require('../config/database');
const translationRepository = require('../repositories/translation.repository');
const localeRepository = require('../repositories/locale.repository');
const tagRepository = require('../repositories/tag.repository');
const ApiError = require('../utils/ApiError');

class TranslationService {
  async getById(id) {
    const translation = await translationRepository.findById(id);
    if (!translation) {
      throw new ApiError(404, 'Translation not found');
    }
    return translation;
  }

  async search(filters) {
    let localeId = null;
    if (filters.locale) {
      const locale = await localeRepository.findByCode(filters.locale);
      if (!locale) {
        throw new ApiError(422, `Locale '${filters.locale}' does not exist`);
      }
      localeId = locale.id;
    }

    const { rows, total } = await translationRepository.search({ ...filters, localeId });

    return {
      data: rows,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async create(data) {
    const existing = await translationRepository.findByKey(data.key);
    if (existing) {
      throw new ApiError(409, `Translation key '${data.key}' already exists`);
    }

    const localeIds = await this.getLocaleIds(Object.keys(data.translations));

    const id = await transaction(async (client) => {
      const keyId = await translationRepository.createKey(data, client);
      await this.saveValues(keyId, data.translations, localeIds, client);
      await this.saveTags(keyId, data.tags, client);
      return keyId;
    });

    return this.getById(id);
  }

  async update(id, data) {
    await this.getById(id);

    if (data.key) {
      const existing = await translationRepository.findByKey(data.key);
      if (existing && existing.id !== id) {
        throw new ApiError(409, `Translation key '${data.key}' already exists`);
      }
    }

    const localeIds = await this.getLocaleIds(Object.keys(data.translations || {}));

    await transaction(async (client) => {
      await translationRepository.updateKey(id, data, client);
      if (data.translations) {
        await this.saveValues(id, data.translations, localeIds, client);
      }
      if (data.tags) {
        await this.saveTags(id, data.tags, client);
      }
    });

    return this.getById(id);
  }

  async delete(id) {
    const deleted = await translationRepository.deleteKey(id);
    if (!deleted) {
      throw new ApiError(404, 'Translation not found');
    }
  }

  // converts codes to ids -> { en: 1, fr: 2 }
  // throws 422 if a locale is not added yet
  async getLocaleIds(codes) {
    if (!codes.length) return {};

    const locales = await localeRepository.findByCodes(codes);
    const localeIds = {};
    locales.forEach((locale) => {
      localeIds[locale.code] = locale.id;
    });

    const missing = codes.filter((code) => !localeIds[code]);
    if (missing.length) {
      throw new ApiError(422, `Locale not found: ${missing.join(', ')}. Please add the locale first`);
    }
    return localeIds;
  }

  // null value = delete translation for that locale
  async saveValues(keyId, translations, localeIds, client) {
    const toSave = [];
    const toDelete = [];

    Object.entries(translations).forEach(([code, value]) => {
      if (value === null) {
        toDelete.push(localeIds[code]);
      } else {
        toSave.push({ localeId: localeIds[code], value });
      }
    });

    if (toSave.length) await translationRepository.upsertValues(keyId, toSave, client);
    if (toDelete.length) await translationRepository.deleteValues(keyId, toDelete, client);
  }

  async saveTags(keyId, tags, client) {
    const names = [...new Set(tags)];
    const tagRows = names.length ? await tagRepository.findOrCreate(names, client) : [];
    await translationRepository.syncTags(keyId, tagRows.map((tag) => tag.id), client);
  }
}

module.exports = new TranslationService();
