const formatters = require('./formatters');
const urlParser = require('./urlParser');
const keywordExtractor = require('./keywordExtractor');

module.exports = {
  ...formatters,
  ...urlParser,
  ...keywordExtractor,
};
