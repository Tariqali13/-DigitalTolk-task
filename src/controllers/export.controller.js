const config = require('../config');
const exportService = require('../services/export.service');

const exportLocale = async (req, res) => {
  const { tags } = req.validatedQuery;
  const result = await exportService.exportLocale(req.params.locale, tags);

  // headers for CDN / browser caching. if the client sends back the same ETag
  // in If-None-Match we just return 304 without the body
  const cacheControl = config.cdnMaxAge > 0
    ? `public, max-age=0, s-maxage=${config.cdnMaxAge}`
    : 'public, no-cache';

  res.set({
    ETag: result.etag,
    'Cache-Control': cacheControl,
  });

  if (req.fresh) {
    return res.status(304).end();
  }

  res.type('application/json').send(result.json);
};

module.exports = { exportLocale };
