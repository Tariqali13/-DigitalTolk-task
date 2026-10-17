const Joi = require('joi');

const LOCALE_REGEX = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/; // e.g. en, fr, pt-BR, zh-Hant
const TAG_REGEX = /^[a-z0-9_-]+$/;

const localeCode = Joi.string().trim().max(20).pattern(LOCALE_REGEX)
  .messages({ 'string.pattern.base': '{#label} must be a valid locale code like en or pt-BR' });

const tagName = Joi.string().trim().lowercase().max(50).pattern(TAG_REGEX)
  .messages({ 'string.pattern.base': '{#label} can only contain letters, numbers, - and _' });

// "web,mobile" -> ['web', 'mobile']
const tagList = Joi.string().custom((value, helpers) => {
  const tags = value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (tags.some((tag) => !TAG_REGEX.test(tag) || tag.length > 50)) {
    return helpers.error('any.invalid');
  }
  return tags;
});

const idParam = Joi.object({
  id: Joi.number().integer().min(1).required(),
});

module.exports = { localeCode, tagName, tagList, idParam };
