const express = require('express');
const { z } = require('zod');
const { Order } = require('../models');
const { asyncHandler, validate, serializeOrder } = require('../utils');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { createOrder } = require('../services/orders');
const { itemSchema } = require('./products');

const router = express.Router();
const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(150).optional(),
  customerEmail: z.string().trim().email().max(254).optional(),
  customerAddress: z.string().trim().min(1).max(1000),
  items: z.array(itemSchema).min(1).max(100)
});

router.post('/', optionalAuth, validate(orderSchema), asyncHandler(async (req, res) => {
  if (!req.user && (!req.body.customerName || !req.body.customerEmail)) {
    return res.status(400).json({ message: 'Name and email are required for guest orders' });
  }
  const order = await createOrder({ input: req.body, customer: req.user });
  return res.status(201).json(serializeOrder(order));
}));

router.get('/mine', requireAuth('customer'), asyncHandler(async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
  return res.json(orders.map(serializeOrder));
}));

module.exports = { router, orderSchema };
