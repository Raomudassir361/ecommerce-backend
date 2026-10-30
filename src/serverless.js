const app = require('./app');
const { config, validateRuntimeConfig } = require('./config');
const { connectToDatabase } = require('./database');

async function handler(req, res) {
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
}

module.exports = handler;
