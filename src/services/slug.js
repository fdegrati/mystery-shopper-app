const { v4: uuidv4 } = require('uuid');

function generateSlug(prefix = '') {
  const uuid = uuidv4();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

function generateShortSlug() {
  return uuidv4().split('-')[0];
}

module.exports = {
  generateSlug,
  generateShortSlug
};
