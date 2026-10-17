const Joi = require('joi');
const { localeCode, tagName, tagList } = require('./common');

const key = Joi.string().trim().max(255).pattern(/^[A-Za-z0-9_.-]+$/)
  .messages({ 'string.pattern.base': 'key can only contain letters, numbers, dots, - and _' });

const createTranslation = Joi.object({
  key: key.required(),
  description: Joi.string().trim().max(1000).allow('', null),
  tags: Joi.array().items(tagName).max(20).default([]),
  translations: Joi.object()
    .pattern(localeCode, Joi.string().max(10000).allow(''))
    // without this, stripUnknown removes invalid locale codes silently and the api returns 201
    // (caught this in the tests)
    .options({ stripUnknown: false })
    .default({}),
});

const updateTranslation = Joi.object({
  key,
  description: Joi.string().trim().max(1000).allow('', null),
  tags: Joi.array().items(tagName).max(20),
  // send null for a locale to remove its translation
  translations: Joi.object()
    .pattern(localeCode, Joi.string().max(10000).allow('', null))
    .options({ stripUnknown: false }),
}).min(1);

const searchTranslations = Joi.object({
  key: Joi.string().trim().max(255),
  content: Joi.string().trim().max(255),
  tags: tagList,
  locale: localeCode,
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const exportQuery = Joi.object({
  tags: tagList.default([]),
});

module.exports = { createTranslation, updateTranslation, searchTranslations, exportQuery };
