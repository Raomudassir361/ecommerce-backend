const { z } = require('zod');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({ message: result.error.issues[0]?.message || 'Invalid request' });
    }
    req[source] = result.data;
    return next();
  };
}

async function nextSequence(name) {
  const { Counter } = require('./models');
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

function getDiscount(product) {
  return product.oldPrice > 0 && product.oldPrice > product.price
    ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
    : 0;
}

function getStockStatus(stock) {
  if (stock <= 0) return 'out_of_stock';
  return stock <= 10 ? 'low_stock' : 'in_stock';
}

function serializeProduct(product) {
  const value = typeof product.toObject === 'function' ? product.toObject() : product;
  return { ...value, discount: getDiscount(value), stockStatus: getStockStatus(value.stock) };
}

function serializeUser(user) {
  const value = typeof user.toObject === 'function' ? user.toObject() : user;
  const { _id, passwordHash, createdAt, __v, ...fields } = value;
  return { ...fields, id: String(_id), joinedDate: createdAt };
}

function serializeOrder(order) {
  const value = typeof order.toObject === 'function' ? order.toObject() : order;
  const { _id, __v, ...fields } = value;
  return { ...fields, id: value.id || String(_id) };
}

function calculateTotals(subtotal) {
  const tax = Math.round(subtotal * 0.05);
  const shipping = subtotal > 0 && subtotal < 5000 ? 250 : 0;
  return { subtotal, tax, shipping, total: subtotal + tax + shipping };
}

const idParamSchema = z.object({ id: z.string().min(1) });

module.exports = {
  asyncHandler,
  validate,
  nextSequence,
  getDiscount,
  getStockStatus,
  serializeProduct,
  serializeUser,
  serializeOrder,
  calculateTotals,
  idParamSchema
};
