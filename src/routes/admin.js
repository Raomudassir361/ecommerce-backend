const express = require('express');
const { z } = require('zod');
const mongoose = require('mongoose');
const { Product, Order, User } = require('../models');
const {
  asyncHandler,
  validate,
  nextSequence,
  serializeProduct,
  serializeOrder,
  serializeUser
} = require('../utils');
const { createProductSchema, updateProductSchema } = require('./products');
const { orderSchema } = require('./orders');
const { createOrder, reserveStock, restoreStock, HttpError } = require('../services/orders');

const router = express.Router();

function isDuplicateKey(error) {
  return error?.code === 11000;
}

function objectId(id) {
  return mongoose.isValidObjectId(id) ? id : null;
}

router.get('/products', asyncHandler(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  return res.json(products.map(serializeProduct));
}));

router.post('/products', validate(createProductSchema), asyncHandler(async (req, res) => {
  const input = req.body;
  const sequence = await nextSequence('product');
  let id = input.id || `prod-${Date.now()}-${sequence}`;
  if (input.id && await Product.exists({ id })) id = `prod-${Date.now()}-${sequence}`;
  const sku = input.sku || `PK-${String(await nextSequence('sku')).padStart(4, '0')}`;
  try {
    const product = await Product.create({ ...input, id, sku });
    return res.status(201).json(serializeProduct(product));
  } catch (error) {
    if (isDuplicateKey(error)) return res.status(409).json({ message: 'A product with this SKU or ID already exists' });
    throw error;
  }
}));

router.put('/products/:id', validate(updateProductSchema), asyncHandler(async (req, res) => {
  let product;
  try {
    product = await Product.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (isDuplicateKey(error)) return res.status(409).json({ message: 'A product with this SKU already exists' });
    throw error;
  }
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json(serializeProduct(product));
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({ id: req.params.id });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.status(204).end();
}));

router.get('/orders', asyncHandler(async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  return res.json(orders.map(serializeOrder));
}));

router.post('/orders', validate(orderSchema), asyncHandler(async (req, res) => {
  if (!req.body.customerName || !req.body.customerEmail) {
    return res.status(400).json({ message: 'Name and email are required' });
  }
  const order = await createOrder({ input: req.body });
  return res.status(201).json(serializeOrder(order));
}));

router.patch('/orders/:id', validate(z.object({
  status: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
})), asyncHandler(async (req, res) => {
  const order = await Order.findOne({ id: req.params.id });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (order.status !== req.body.status) {
    let restored = [];
    let reservations = [];
    const previousStatus = order.status;
    if (req.body.status === 'Cancelled') {
      try {
        for (const [productId, quantity] of aggregateOrderItems(order.items)) {
          const result = await Product.updateOne({ id: productId }, { $inc: { stock: quantity } });
          if (result.matchedCount) restored.push({ productId, quantity });
        }
      } catch (error) {
        await reverseRestoredStock(restored);
        throw error;
      }
    } else if (order.status === 'Cancelled') {
      try {
        ({ reservations } = await reserveStock(order.items));
      } catch (error) {
        if (error.status === 404) {
          throw new HttpError(409, 'A product from this order is no longer available');
        }
        throw error;
      }
    }
    let result;
    try {
      result = await Order.updateOne(
        { id: order.id, status: previousStatus },
        { $set: { status: req.body.status } }
      );
    } catch (error) {
      if (restored.length) await reverseRestoredStock(restored);
      if (reservations.length) await restoreStock(reservations);
      throw error;
    }
    if (result.modifiedCount !== 1) {
      if (restored.length) await reverseRestoredStock(restored);
      if (reservations.length) await restoreStock(reservations);
      throw new HttpError(409, 'The order status changed; reload and try again');
    }
  }
  const updatedOrder = await Order.findOne({ id: req.params.id });
  return res.json(serializeOrder(updatedOrder));
}));

router.delete('/orders/:id', asyncHandler(async (req, res) => {
  const order = await Order.findOneAndDelete({ id: req.params.id });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.status(204).end();
}));

router.get('/users', asyncHandler(async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  return res.json(users.map(serializeUser));
}));

router.patch('/users/:id', validate(z.object({
  role: z.enum(['admin', 'customer']).optional(),
  status: z.enum(['Active', 'Suspended']).optional()
}).refine((value) => Object.keys(value).length > 0, 'At least one field is required')), asyncHandler(async (req, res) => {
  const targetId = objectId(req.params.id);
  if (!targetId) return res.status(404).json({ message: 'User not found' });
  const user = await User.findById(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const ownAccount = String(user._id) === String(req.user._id);
  const removesActiveAdmin = user.role === 'admin' && user.status === 'Active' &&
    ((req.body.role && req.body.role !== 'admin') || (req.body.status && req.body.status !== 'Active'));
  if (ownAccount && removesActiveAdmin) {
    return res.status(400).json({ message: 'You cannot suspend or demote your own account' });
  }
  if (removesActiveAdmin && await User.countDocuments({ role: 'admin', status: 'Active' }) <= 1) {
    return res.status(400).json({ message: 'The last active admin cannot be removed' });
  }

  Object.assign(user, req.body);
  await user.save();
  return res.json(serializeUser(user));
}));

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const targetId = objectId(req.params.id);
  if (!targetId) return res.status(404).json({ message: 'User not found' });
  const user = await User.findById(targetId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ message: 'You cannot delete your own account' });
  }
  if (user.role === 'admin' && user.status === 'Active' &&
      await User.countDocuments({ role: 'admin', status: 'Active' }) <= 1) {
    return res.status(400).json({ message: 'The last active admin cannot be removed' });
  }
  await user.deleteOne();
  return res.status(204).end();
}));

router.get('/dashboard/metrics', asyncHandler(async (_req, res) => {
  const now = new Date();
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  }
  const start = months[0];
  const [orders, productCount, activeUsers] = await Promise.all([
    Order.find({ createdAt: { $gte: start } }),
    Product.countDocuments(),
    User.countDocuments({ status: 'Active' })
  ]);
  const allOrders = await Order.find({ status: { $ne: 'Cancelled' } }, { total: 1, items: 1, createdAt: 1 });
  const monthlySales = months.map((month) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const revenue = orders.reduce((sum, order) => (
      order.status !== 'Cancelled' && order.createdAt >= month && order.createdAt < nextMonth
        ? sum + order.total
        : sum
    ), 0);
    return { month: month.toLocaleString('en', { month: 'short' }), revenue };
  });
  const categories = await Product.aggregate([
    { $group: { _id: '$category', value: { $sum: 1 } } },
    { $sort: { value: -1 } }
  ]);
  const productTotal = categories.reduce((sum, category) => sum + category.value, 0);
  return res.json({
    revenue: allOrders.reduce((sum, order) => sum + order.total, 0),
    orders: await Order.countDocuments(),
    products: productCount,
    activeUsers,
    monthlySales,
    categoryBreakdown: categories.map((category) => ({
      name: category._id,
      value: productTotal ? Math.round((category.value / productTotal) * 100) : 0
    }))
  });
}));

function aggregateOrderItems(items) {
  const quantities = new Map();
  for (const item of items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  return quantities;
}

async function reverseRestoredStock(items) {
  for (const item of items) {
    const result = await Product.updateOne(
      { id: item.productId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );
    if (result.modifiedCount !== 1) throw new Error(`Could not reverse stock for product ${item.productId}`);
  }
}

module.exports = router;
