const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

const register = async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 201, 'User registered successfully', result);
};

const login = async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, 200, 'Login successful', result);
};

const me = async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  sendSuccess(res, 200, 'Profile fetched successfully', user);
};

module.exports = { register, login, me };
