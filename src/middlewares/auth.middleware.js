const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('../utils/ApiError');

const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    throw new ApiError(401, 'Unauthorized, token not provided');
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired, please login again' : 'Invalid token';
    throw new ApiError(401, message);
  }

  next();
};

module.exports = auth;
