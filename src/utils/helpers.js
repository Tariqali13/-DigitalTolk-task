// escape % and _ so user input is matched literally in LIKE queries
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

module.exports = { escapeLike };
