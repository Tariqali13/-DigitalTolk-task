const localeRepository = require('../repositories/locale.repository');
const ApiError = require('../utils/ApiError');

class LocaleService {
  getAll() {
    return localeRepository.findAll();
  }

  async create(data) {
    const existing = await localeRepository.findByCode(data.code);
    if (existing) {
      throw new ApiError(409, `Locale '${data.code}' already exists`);
    }
    return localeRepository.create(data);
  }
}

module.exports = new LocaleService();
