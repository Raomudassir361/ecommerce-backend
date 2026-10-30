const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { config } = require('./config');
const { User, Product, Review } = require('./models');

const sampleProducts = [
  {
    name: 'Classic Cotton Tee',
    category: 'T-Shirts',
    styles: ['Casual'],
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L', 'XL'],
    price: 1299,
    oldPrice: 1599,
    stock: 35,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
    description: 'A comfortable everyday cotton t-shirt.'
  },
  {
    name: 'Everyday Denim Jacket',
    category: 'Jackets',
    styles: ['Casual'],
    colors: ['Blue'],
    sizes: ['S', 'M', 'L', 'XL'],
    price: 4499,
    oldPrice: 0,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923',
    description: 'A versatile denim jacket for everyday wear.'
  },
  {
    name: 'Canvas Weekend Bag',
    category: 'Accessories',
    styles: ['Travel'],
    colors: ['Beige', 'Black'],
    sizes: ['One Size'],
    price: 2999,
    oldPrice: 3499,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62',
    description: 'A durable canvas bag for short trips.'
  }
];

async function seed() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(config.mongoUri);
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  if (!configSeedValue('SEED_ADMIN_NAME') || !configSeedValue('SEED_ADMIN_EMAIL') || !configSeedValue('SEED_ADMIN_PASSWORD')) {
    throw new Error('SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD are required');
  }

  const email = process.env.SEED_ADMIN_EMAIL.toLowerCase();
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: process.env.SEED_ADMIN_NAME,
      email,
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12),
      role: 'admin',
      status: 'Active'
    });
    console.log(`Created admin account ${email}`);
  } else {
    console.log(`Admin account ${email} already exists; leaving it unchanged`);
  }

  if (await Product.countDocuments() === 0) {
    await Product.insertMany(sampleProducts.map((product, index) => ({
      ...product,
      id: `prod-${Date.now()}-${index + 1}`,
      sku: `PK-${String(index + 1).padStart(4, '0')}`
    })));
    console.log('Created sample catalog');
  }

  if (process.argv.includes('--demo')) {
    let customer = await User.findOne({ email: 'customer@example.com' });
    if (!customer) {
      customer = await User.create({
        name: 'Demo Customer',
        email: 'customer@example.com',
        passwordHash: await bcrypt.hash('customer123', 12),
        role: 'customer'
      });
    }
    const products = await Product.find().limit(3);
    if (products.length && !(await Review.exists({ customer: customer._id }))) {
      await Review.insertMany(products.map((product) => ({
        productId: product.id,
        productName: product.name,
        customer: customer._id,
        customerName: customer.name,
        rating: 5,
        comment: 'Great quality and a perfect fit.'
      })));
    }
    console.log('Added demo customer and reviews');
  }
}

function configSeedValue(name) {
  return Boolean(process.env[name]?.trim());
}

seed()
  .catch((error) => {
    console.error('Unable to seed database:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
