process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
process.env.FRONTEND_ORIGINS = 'https://store.example/';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const serverlessHandler = require('../src/serverless');
const { calculateTotals, getDiscount, getStockStatus, serializeProduct } = require('../src/utils');
const { orderSchema } = require('../src/routes/orders');

test('serverless routes normalize Vercel suffix paths for Express', () => {
  const cases = [
    { input: '/auth/customer', expected: '/api/auth/customer' },
    { input: '/api/auth/customer', expected: '/api/auth/customer' },
    { input: '/products?category=shirts', expected: '/api/products?category=shirts' }
  ];

  for (const { input, expected } of cases) {
    const req = { url: input };
    serverlessHandler.normalizeApiPath(req);
    assert.equal(req.url, expected);
  }

  const dynamicReq = { url: '/product-123' };
  serverlessHandler.normalizeApiPath(dynamicReq, undefined, '/api/products');
  assert.equal(dynamicReq.url, '/api/products/product-123');
});

test('catch-all Vercel functions expose the Express API without per-route function limits', () => {
  const catchAllHandler = require('../api/[...path]');
  const rootHandler = require('../api');
  assert.equal(typeof catchAllHandler, 'function');
  assert.equal(typeof rootHandler, 'function');

  const routes = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/customer',
    '/api/auth/me',
    '/api/products',
    '/api/products/prod-123',
    '/api/products/prod-123/reviews',
    '/api/reviews',
    '/api/orders',
    '/api/orders/mine',
    '/api/newsletter',
    '/api/admin/products',
    '/api/admin/products/prod-123',
    '/api/admin/orders',
    '/api/admin/orders/ORD-PK-1',
    '/api/admin/users/012345678901234567890123',
    '/api/admin/dashboard/metrics'
  ];

  for (const route of routes) {
    const req = { url: route };
    serverlessHandler.normalizeApiPath(req);
    assert.equal(req.url, route);
  }
});

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
  const paths = [
    '/api/admin/products',
    '/api/admin/products/prod-123',
    '/api/admin/orders',
    '/api/admin/orders/ORD-PK-1',
    '/api/admin/users',
    '/api/admin/users/012345678901234567890123',
    '/api/admin/dashboard/metrics'
  ];

  for (const path of paths) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401, `${path} should require an admin session`);
    assert.equal(typeof response.body.message, 'string');
  }
});

test('customer-only endpoints require authentication', async () => {
  const customer = await request(app).get('/api/auth/customer');
  assert.equal(customer.status, 401);
  const response = await request(app).get('/api/orders/mine');
  assert.equal(response.status, 401);
});

test('auth endpoints are mounted at the documented paths', async () => {
  const login = await request(app).post('/api/auth/login').send({ email: 'invalid', password: 'short' });
  assert.equal(login.status, 400);
  const register = await request(app).post('/api/auth/register').send({ email: 'invalid', password: 'short' });
  assert.equal(register.status, 400);
  const logout = await request(app).post('/api/auth/logout');
  assert.equal(logout.status, 204);
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
