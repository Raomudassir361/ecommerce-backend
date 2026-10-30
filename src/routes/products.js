const express = require('express');
const { z } = require('zod');
const { Product, Review } = require('../models');
const { asyncHandler, validate, serializeProduct } = require('../utils');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  color: z.string().max(80).optional(),
  size: z.string().max(80).optional()
});
const createProductSchema = z.object({
  id: z.string().regex(/^prod-\d+$/).optional(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(100),
  styles: z.array(z.string().max(80)).optional(),
  colors: z.array(z.string().max(80)).optional(),
  sizes: z.array(z.string().max(80)).optional(),
  price: z.number().nonnegative(),
  oldPrice: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative(),
  image: z.string().max(2048).optional(),
  description: z.string().max(10000).optional()
});
const updateProductSchema = createProductSchema.partial().omit({ id: true });

router.get('/', asyncHandler(async (_req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  return res.json(products.map(serializeProduct));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ id: req.params.id });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  return res.json(serializeProduct(product));
}));

router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const reviews = await Review.find({ productId: req.params.id }).sort({ createdAt: -1 });
  return res.json(reviews);
}));

router.post('/:id/reviews', requireAuth('customer'), validate(z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(3000)
})), asyncHandler(async (req, res) => {
  const product = await Product.findOne({ id: req.params.id });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  const review = await Review.create({
    productId: product.id,
    productName: product.name,
    customer: req.user._id,
    customerName: req.user.name,
    rating: req.body.rating,
    comment: req.body.comment
  });
  return res.status(201).json(review);
}));

module.exports = { router, createProductSchema, updateProductSchema, itemSchema };
