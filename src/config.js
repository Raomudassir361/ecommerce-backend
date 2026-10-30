require('dotenv').config();

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const config = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  trustProxy: parseBoolean(process.env.TRUST_PROXY),
  frontendOrigins: (process.env.FRONTEND_ORIGINS ||
    'https://react-e-commerce-assignement.vercel.app,https://ecommerce-dashboard-zeta-ecru.vercel.app,http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieName: 'ecommerce_session'
};

function validateRuntimeConfig() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required');
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
  if (!['lax', 'strict', 'none'].includes(config.cookieSameSite)) {
    throw new Error('COOKIE_SAMESITE must be lax, strict, or none');
  }
  if (config.cookieSameSite === 'none' && config.nodeEnv === 'production' && !parseBoolean(process.env.HTTPS_ENABLED, true)) {
    throw new Error('COOKIE_SAMESITE=none requires HTTPS in production');
  }
}

module.exports = { config, validateRuntimeConfig };
