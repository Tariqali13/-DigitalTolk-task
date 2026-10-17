const Joi = require('joi');
const { tagName } = require('./common');

const createTag = Joi.object({
  name: tagName.required(),
});

module.exports = { createTag };
