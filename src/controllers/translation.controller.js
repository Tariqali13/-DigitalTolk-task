const translationService = require('../services/translation.service');
const { sendSuccess } = require('../utils/response');

const search = async (req, res) => {
  const result = await translationService.search(req.validatedQuery);
  res.json({ success: true, message: 'Translations fetched successfully', ...result });
};

const getById = async (req, res) => {
  const translation = await translationService.getById(req.params.id);
  sendSuccess(res, 200, 'Translation fetched successfully', translation);
};

const create = async (req, res) => {
  const translation = await translationService.create(req.body);
  sendSuccess(res, 201, 'Translation created successfully', translation);
};

const update = async (req, res) => {
  const translation = await translationService.update(req.params.id, req.body);
  sendSuccess(res, 200, 'Translation updated successfully', translation);
};

const remove = async (req, res) => {
  await translationService.delete(req.params.id);
  sendSuccess(res, 200, 'Translation deleted successfully', null);
};

module.exports = { search, getById, create, update, remove };
