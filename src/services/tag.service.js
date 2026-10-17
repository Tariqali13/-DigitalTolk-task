const tagRepository = require('../repositories/tag.repository');
const ApiError = require('../utils/ApiError');

class TagService {
  getAll() {
    return tagRepository.findAll();
  }

  async create({ name }) {
    const existing = await tagRepository.findByName(name);
    if (existing) {
      throw new ApiError(409, `Tag '${name}' already exists`);
    }
    return tagRepository.create(name);
  }
}

module.exports = new TagService();
