const tagService = require('../services/tag.service');
const { sendSuccess } = require('../utils/response');

const getAll = async (req, res) => {
  const tags = await tagService.getAll();
  sendSuccess(res, 200, 'Tags fetched successfully', tags);
};

const create = async (req, res) => {
  const tag = await tagService.create(req.body);
  sendSuccess(res, 201, 'Tag created successfully', tag);
};

module.exports = { getAll, create };
