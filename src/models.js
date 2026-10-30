const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'customer'], default: 'customer', required: true },
  status: { type: String, enum: ['Active', 'Suspended'], default: 'Active', required: true },
  avatar: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: true } });

const productSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  sku: { type: String, required: true, unique: true, trim: true },
  category: { type: String, required: true, trim: true },
  styles: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  sizes: { type: [String], default: [] },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: 0, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  image: { type: String, default: '' },
  description: { type: String, default: '' }
}, { timestamps: true, versionKey: false });

const orderItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  color: { type: String, default: '' },
  size: { type: String, default: '' }
}, { _id: false });

const orderSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, lowercase: true },
  customerAddress: { type: String, required: true },
  paymentMethod: { type: String, default: 'Cash on Delivery' },
  items: { type: [orderItemSchema], required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  shipping: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], default: 'Pending' }
}, { timestamps: true, versionKey: false });

const reviewSchema = new Schema({
  productId: { type: String, required: true, index: true },
  productName: { type: String, required: true },
  customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

const subscriberSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }
}, { timestamps: true });

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Product: mongoose.models.Product || mongoose.model('Product', productSchema),
  Order: mongoose.models.Order || mongoose.model('Order', orderSchema),
  Review: mongoose.models.Review || mongoose.model('Review', reviewSchema),
  Subscriber: mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema),
  Counter: mongoose.models.Counter || mongoose.model('Counter', counterSchema)
};
