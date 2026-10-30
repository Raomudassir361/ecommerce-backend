process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
process.env.FRONTEND_ORIGINS = 'https://store.example/';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { calculateTotals, getDiscount, getStockStatus, serializeProduct } = require('../src/utils');
const { orderSchema } = require('../src/routes/orders');

test('health endpoint returns an OK status', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('unknown paths return JSON 404 responses', async () => {
  const response = await request(app).get('/not-an-api-route');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: 'Not found' });
});

test('admin endpoints require authentication', async () => {
  const response = await request(app).get('/api/admin/products');
  assert.equal(response.status, 401);
  assert.equal(typeof response.body.message, 'string');
  const unknownAdminPath = await request(app).get('/api/admin/unknown');
  assert.equal(unknownAdminPath.status, 401);
});

test('customer-only endpoints require authentication', async () => {
  const response = await request(app).get('/api/orders/mine');
  assert.equal(response.status, 401);
});

test('CORS accepts allowed origins and rejects other origins', async () => {
  const allowed = await request(app).get('/api/health').set('Origin', 'https://store.example');
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://store.example');
  const denied = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
  assert.equal(denied.status, 403);
  assert.deepEqual(denied.body, { message: 'Origin is not allowed' });
});

test('authentication input is validated before database access', async () => {
  const response = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' });
  assert.equal(response.status, 400);
  assert.equal(typeof response.body.message, 'string');
});

test('server-side totals apply 5 percent tax and the delivery threshold', () => {
  assert.deepEqual(calculateTotals(1000), { subtotal: 1000, tax: 50, shipping: 250, total: 1300 });
  assert.deepEqual(calculateTotals(5000), { subtotal: 5000, tax: 250, shipping: 0, total: 5250 });
});

test('order input ignores any client-supplied price', () => {
  const parsed = orderSchema.parse({
    customerName: 'Guest',
    customerEmail: 'guest@example.com',
    customerAddress: 'Address',
    items: [{ productId: 'p1', quantity: 1, price: 0.01 }]
  });
  assert.equal('price' in parsed.items[0], false);
});

test('product responses derive discount and stock status', () => {
  assert.equal(getDiscount({ price: 75, oldPrice: 100 }), 25);
  assert.equal(getStockStatus(0), 'out_of_stock');
  assert.equal(getStockStatus(10), 'low_stock');
  assert.equal(getStockStatus(11), 'in_stock');
  assert.equal(serializeProduct({ id: 'p1', price: 75, oldPrice: 100, stock: 0 }).discount, 25);
});

test('orders reject malformed product lines before database access', async () => {
  const response = await request(app).post('/api/orders').send({
    customerName: 'Guest',
    customerEmail: 'guest@example.com',
    customerAddress: 'Address',
    items: [{ productId: 'p1', quantity: 0 }]
  });
  assert.equal(response.status, 400);
});
