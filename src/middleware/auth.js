const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { User } = require('../models');
const { asyncHandler, serializeUser } = require('../utils');

const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[config.cookieName];
  if (!token) return next();

  let claims;
  try {
    claims = jwt.verify(token, config.jwtSecret);
  } catch {
    return next();
  }
  const user = await User.findById(claims.sub);
  if (user && user.status === 'Active') req.user = user;
  return next();
});

function requireAuth(role) {
  return asyncHandler(async (req, res, next) => {
    const token = req.cookies?.[config.cookieName];
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    let claims;
    try {
      claims = jwt.verify(token, config.jwtSecret);
    } catch {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(claims.sub);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (role && user.role !== role) {
      return res.status(403).json({ message: 'You do not have permission to access this resource' });
    }
    req.user = user;
    return next();
  });
}

function currentUser(req, res) {
  return res.json(serializeUser(req.user));
}

module.exports = { optionalAuth, requireAuth, currentUser };
