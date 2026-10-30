const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { User } = require('../models');
const { config } = require('../config');
const { asyncHandler, validate, serializeUser } = require('../utils');
const { requireAuth, currentUser } = require('../middleware/auth');

const router = express.Router();
const credentialsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.cookieSameSite,
    path: '/api',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(config.cookieName, token, cookieOptions());
}

router.post('/register', validate(credentialsSchema), asyncHandler(async (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Name is required' });
  const email = req.body.email.toLowerCase();
  if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists' });

  const user = await User.create({
    name: req.body.name,
    email,
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: 'customer'
  });
  setSession(res, user);
  return res.status(201).json(serializeUser(user));
}));

router.post('/login', validate(credentialsSchema.pick({ email: true, password: true })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (user.status === 'Suspended') return res.status(403).json({ message: 'This account has been suspended' });

  setSession(res, user);
  return res.json(serializeUser(user));
}));

router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
  return res.status(204).end();
});
router.get('/customer', requireAuth('customer'), currentUser);
router.get('/me', requireAuth('admin'), currentUser);

module.exports = router;
