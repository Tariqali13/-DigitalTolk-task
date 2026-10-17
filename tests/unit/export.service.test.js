jest.mock('../../src/repositories/translation.repository');
jest.mock('../../src/repositories/locale.repository');

const exportService = require('../../src/services/export.service');
const translationRepository = require('../../src/repositories/translation.repository');
const localeRepository = require('../../src/repositories/locale.repository');

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exportService.cache.clear();
    localeRepository.findByCode.mockResolvedValue({ id: 1, code: 'en' });
    translationRepository.getVersion.mockResolvedValue(1);
    translationRepository.getExportJson.mockResolvedValue('{"a":"b"}');
  });

  it('should build the json once and then use the cache', async () => {
    const first = await exportService.exportLocale('en');
    const second = await exportService.exportLocale('en');

    expect(first.json).toBe('{"a":"b"}');
    expect(second).toBe(first);
    expect(translationRepository.getExportJson).toHaveBeenCalledTimes(1);
  });

  it('should rebuild when the version changes', async () => {
    const first = await exportService.exportLocale('en');
    translationRepository.getVersion.mockResolvedValue(2);
    translationRepository.getExportJson.mockResolvedValue('{"a":"changed"}');
    const second = await exportService.exportLocale('en');

    expect(second.json).toBe('{"a":"changed"}');
    expect(second.etag).not.toBe(first.etag);
  });

  it('should cache tag filters separately, order of tags does not matter', async () => {
    await exportService.exportLocale('en', ['web', 'mobile']);
    await exportService.exportLocale('en', ['mobile', 'web']);
    await exportService.exportLocale('en');

    expect(translationRepository.getExportJson).toHaveBeenCalledTimes(2);
  });

  describe('when the cache is full', () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        await exportService.exportLocale('en', [`tag${i}`]);
      }
      translationRepository.getExportJson.mockClear();
    });

    it('should remove only the least recently used entry', async () => {
      await exportService.exportLocale('en', ['tag0']); // tag0 is used again, tag1 is now the oldest
      await exportService.exportLocale('en', ['tag100']);

      expect(exportService.cache.size).toBe(100);
      expect(exportService.cache.has('1:tag0')).toBe(true);
      expect(exportService.cache.has('1:tag1')).toBe(false);
      expect(translationRepository.getExportJson).toHaveBeenCalledTimes(1);
    });

    it('should not remove anything when an existing entry is rebuilt', async () => {
      translationRepository.getVersion.mockResolvedValue(2);
      await exportService.exportLocale('en', ['tag50']);

      expect(exportService.cache.size).toBe(100);
      expect(exportService.cache.has('1:tag0')).toBe(true);
    });
  });

  it('should throw 404 for unknown locale', async () => {
    localeRepository.findByCode.mockResolvedValue(null);
    await expect(exportService.exportLocale('xx')).rejects.toMatchObject({ statusCode: 404 });
  });
});
