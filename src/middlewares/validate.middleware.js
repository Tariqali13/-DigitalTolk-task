const ApiError = require('../utils/ApiError');

// usage: validate(schema) or validate(schema, 'query') / validate(schema, 'params')
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    errors: { wrap: { label: false } },
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new ApiError(422, 'Validation error', errors);
  }

  // NOTE: in express 5 req.query is a getter and can't be overwritten,
  // so for query params the cleaned values are saved in req.validatedQuery
  if (source === 'query') {
    req.validatedQuery = value;
  } else {
    req[source] = value;
  }
  next();
};

module.exports = validate;
