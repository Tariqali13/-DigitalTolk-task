const localeService = require('../services/locale.service');
const { sendSuccess } = require('../utils/response');

const getAll = async (req, res) => {
  const locales = await localeService.getAll();
  sendSuccess(res, 200, 'Locales fetched successfully', locales);
};

const create = async (req, res) => {
  const locale = await localeService.create(req.body);
  sendSuccess(res, 201, 'Locale created successfully', locale);
};

module.exports = { getAll, create };
