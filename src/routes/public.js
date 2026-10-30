const express = require('express');
const { z } = require('zod');
const { Review, Subscriber } = require('../models');
const { asyncHandler, validate } = require('../utils');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.get('/reviews', asyncHandler(async (_req, res) => {
  const reviews = await Review.find().sort({ createdAt: -1 }).limit(10);
  return res.json(reviews);
}));

router.post('/newsletter', validate(z.object({
  email: z.string().trim().email().max(254)
})), asyncHandler(async (req, res) => {
  try {
    await Subscriber.create({ email: req.body.email.toLowerCase() });
    return res.status(201).json({ message: 'Successfully subscribed to the newsletter' });
  } catch (error) {
    if (error.code === 11000) return res.json({ message: 'This email is already subscribed' });
    throw error;
  }
}));

module.exports = router;
