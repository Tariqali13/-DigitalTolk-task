jest.mock('../../src/config/database', () => ({
  transaction: jest.fn((callback) => callback('client')),
}));
jest.mock('../../src/repositories/translation.repository');
jest.mock('../../src/repositories/locale.repository');
jest.mock('../../src/repositories/tag.repository');

const translationService = require('../../src/services/translation.service');
const translationRepository = require('../../src/repositories/translation.repository');
const localeRepository = require('../../src/repositories/locale.repository');
const tagRepository = require('../../src/repositories/tag.repository');

describe('TranslationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localeRepository.findByCodes.mockResolvedValue([
      { id: 1, code: 'en' },
      { id: 2, code: 'fr' },
    ]);
    tagRepository.findOrCreate.mockResolvedValue([{ id: 5, name: 'web' }]);
    translationRepository.findById.mockResolvedValue({ id: 10, key: 'home.title' });
  });

  describe('create', () => {
    it('should create the key, values and tags in one transaction', async () => {
      translationRepository.findByKey.mockResolvedValue(null);
      translationRepository.createKey.mockResolvedValue(10);

      const result = await translationService.create({
        key: 'home.title',
        tags: ['web', 'web'],
        translations: { en: 'Home', fr: 'Accueil' },
      });

      expect(result).toEqual({ id: 10, key: 'home.title' });
      expect(translationRepository.upsertValues).toHaveBeenCalledWith(
        10,
        [{ localeId: 1, value: 'Home' }, { localeId: 2, value: 'Accueil' }],
        'client',
      );
      expect(tagRepository.findOrCreate).toHaveBeenCalledWith(['web'], 'client');
      expect(translationRepository.syncTags).toHaveBeenCalledWith(10, [5], 'client');
    });

    it('should throw 409 if key already exists', async () => {
      translationRepository.findByKey.mockResolvedValue({ id: 3, key: 'home.title' });

      await expect(
        translationService.create({ key: 'home.title', tags: [], translations: {} }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(translationRepository.createKey).not.toHaveBeenCalled();
    });

    it('should throw 422 for unknown locales', async () => {
      translationRepository.findByKey.mockResolvedValue(null);

      await expect(
        translationService.create({ key: 'a', tags: [], translations: { de: 'Hallo' } }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('should clear tags when the tag list is empty', async () => {
      translationRepository.findByKey.mockResolvedValue(null);
      translationRepository.createKey.mockResolvedValue(10);

      await translationService.create({ key: 'a', tags: [], translations: {} });

      expect(tagRepository.findOrCreate).not.toHaveBeenCalled();
      expect(translationRepository.syncTags).toHaveBeenCalledWith(10, [], 'client');
      expect(translationRepository.upsertValues).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should save values and delete the ones set to null', async () => {
      await translationService.update(10, { translations: { en: 'Hi', fr: null } });

      expect(translationRepository.upsertValues).toHaveBeenCalledWith(10, [{ localeId: 1, value: 'Hi' }], 'client');
      expect(translationRepository.deleteValues).toHaveBeenCalledWith(10, [2], 'client');
      expect(translationRepository.syncTags).not.toHaveBeenCalled();
    });

    it('should throw 404 if translation does not exist', async () => {
      translationRepository.findById.mockResolvedValue(null);

      await expect(translationService.update(99, { description: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 409 when renaming to a key used by another translation', async () => {
      translationRepository.findByKey.mockResolvedValue({ id: 11, key: 'taken' });

      await expect(translationService.update(10, { key: 'taken' })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('search', () => {
    it('should return data with pagination', async () => {
      translationRepository.search.mockResolvedValue({ rows: [{ id: 1 }], total: 45 });

      const result = await translationService.search({ page: 2, limit: 20 });

      expect(result.pagination).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
      expect(translationRepository.search).toHaveBeenCalledWith({ page: 2, limit: 20, localeId: null });
    });

    it('should pass the locale id when locale is given', async () => {
      localeRepository.findByCode.mockResolvedValue({ id: 2, code: 'fr' });
      translationRepository.search.mockResolvedValue({ rows: [], total: 0 });

      await translationService.search({ locale: 'fr', content: 'x', page: 1, limit: 20 });

      expect(translationRepository.search).toHaveBeenCalledWith(expect.objectContaining({ localeId: 2 }));
    });
  });

  describe('delete', () => {
    it('should throw 404 if nothing was deleted', async () => {
      translationRepository.deleteKey.mockResolvedValue(false);
      await expect(translationService.delete(5)).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
