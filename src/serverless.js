const app = require('./app');
const { config, validateRuntimeConfig } = require('./config');
const { connectToDatabase } = require('./database');

function resolveFallbackPath(req, fallbackPath) {
  return typeof fallbackPath === 'function' ? fallbackPath(req) : fallbackPath;
}

function normalizeApiPath(req, fallbackPath, suffixPrefix) {
  const requestUrl = req.url || '/';
  const queryIndex = requestUrl.indexOf('?');
  const pathname = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : requestUrl.slice(queryIndex);

  if ((pathname === '/' || pathname === '') && fallbackPath) {
    req.url = `${resolveFallbackPath(req, fallbackPath)}${query}`;
  } else if (pathname === '/api' || pathname.startsWith('/api/')) {
    req.url = requestUrl;
  } else if (suffixPrefix) {
    req.url = `${suffixPrefix}${pathname}${query}`;
  } else {
    req.url = `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`;
  }
}

function createHandler(fallbackPath, suffixPrefix) {
  return async function handler(req, res) {
    normalizeApiPath(req, fallbackPath, suffixPrefix);
    try {
      validateRuntimeConfig();
      await connectToDatabase();
      return app(req, res);
    } catch (error) {
      console.error('Database connection failed:', error.message);
      return res.status(503).json({
        message: config.mongoUri ? 'Database unavailable' : 'Database is not configured'
      });
    }
  };
}

const handler = createHandler();
handler.createHandler = createHandler;
handler.normalizeApiPath = normalizeApiPath;

module.exports = handler;
