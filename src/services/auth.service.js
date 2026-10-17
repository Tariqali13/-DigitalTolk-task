const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/user.repository');
const ApiError = require('../utils/ApiError');

// used when the email doesn't exist, see login()
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10);

class AuthService {
  async register({ name, email, password }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ApiError(409, 'Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userRepository.create({ name, email, password: hashedPassword });

    return { user, token: this.generateToken(user) };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);

    // always run bcrypt, even when the user doesn't exist. otherwise login answers much faster
    // for unknown emails and someone could use that to find out which emails are registered
    const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

    if (!user || !isMatch) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const { password: _, ...userData } = user;
    return { user: userData, token: this.generateToken(user) };
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    return user;
  }

  // TODO: refresh tokens + logout (token blacklist), skipped for this assignment
  generateToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }
}

module.exports = new AuthService();
