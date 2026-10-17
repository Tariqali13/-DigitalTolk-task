const ApiError = require('../utils/ApiError');

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ApiError) {
    const body = { success: false, message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.statusCode).json(body);
  }

  // express.json() throws this when the body is not valid json
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }

  // 23505 = unique violation in postgres. services already check for duplicates,
  // this is only for the case when two requests come at the same time
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry, record already exists' });
  }

  console.error(err);
  return res.status(500).json({ success: false, message: 'Something went wrong, please try again later' });
};

module.exports = { notFound, errorHandler };
