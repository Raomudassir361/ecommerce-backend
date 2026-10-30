const { Product, Order } = require('../models');
const { nextSequence, calculateTotals } = require('../utils');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function restoreStock(reservations) {
  for (const reservation of reservations) {
    const result = await Product.updateOne(
      { id: reservation.productId },
      { $inc: { stock: reservation.quantity } }
    );
    if (result.matchedCount !== 1) {
      throw new Error(`Could not restore stock for product ${reservation.productId}`);
    }
  }
}

async function reserveStock(items) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  const ids = [...quantities.keys()];
  const products = await Product.find({ id: { $in: ids } });
  const byId = new Map(products.map((product) => [product.id, product]));
  const reservations = [];

  for (const [productId, quantity] of quantities) {
    const product = byId.get(productId);
    if (!product) throw new HttpError(404, `Product ${productId} was not found`);
    if (quantity > product.stock) {
      throw new HttpError(409, `Not enough stock for ${product.name}`);
    }
  }

  try {
    for (const [productId, quantity] of quantities) {
      const product = byId.get(productId);
      const result = await Product.updateOne(
        { id: productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } }
      );
      if (result.modifiedCount !== 1) {
        throw new HttpError(409, `Not enough stock for ${product.name}`);
      }
      reservations.push({ productId, quantity });
    }
  } catch (error) {
    await restoreStock(reservations);
    throw error;
  }
  return { products: byId, reservations };
}

async function createOrder({ input, customer = null }) {
  const { products, reservations } = await reserveStock(input.items);
  try {
    const items = input.items.map((item) => {
      const product = products.get(item.productId);
      return {
        productId: product.id,
        productName: product.name,
        image: product.image,
        price: product.price,
        quantity: item.quantity,
        color: item.color || '',
        size: item.size || ''
      };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totals = calculateTotals(subtotal);
    const seq = await nextSequence('order');
    const order = await Order.create({
      id: `ORD-PK-${seq}`,
      customer: customer?._id || null,
      customerName: customer?.name || input.customerName,
      customerEmail: customer?.email || input.customerEmail,
      customerAddress: input.customerAddress,
      paymentMethod: 'Cash on Delivery',
      items,
      ...totals
    });
    return order;
  } catch (error) {
    await restoreStock(reservations);
    throw error;
  }
}

module.exports = { HttpError, reserveStock, restoreStock, createOrder };
