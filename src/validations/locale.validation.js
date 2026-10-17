const Joi = require('joi');
const { localeCode } = require('./common');

const createLocale = Joi.object({
  code: localeCode.required(),
  name: Joi.string().trim().max(100).required(),
});

module.exports = { createLocale };
