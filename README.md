# E-commerce Backend API

Standalone Express 4 and MongoDB API for the storefront and admin panel. It serves JSON only; frontend applications are hosted separately.

## Requirements

- Node.js 20 or newer
- MongoDB

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and the seed admin credentials.
2. Install dependencies with `npm install`.
3. Create the initial admin and sample catalog with `npm run seed` (append `-- --demo` to create demo customer reviews).
4. Start the API with `npm run dev`, or use `npm start` in production.
5. Run the tests with `npm test`.

The server listens on port 5000 by default. `FRONTEND_ORIGINS` is a comma-separated origin allow-list. For production, use HTTPS and preferably proxy `/api` through both frontend sites so the session cookie remains first-party.

## API

All endpoints are under `/api`. Health check: `GET /api/health`. Authentication uses an httpOnly, seven-day JWT cookie. Admin endpoints are protected by a current active admin user check on every request.

Public website endpoints: `/products`, `/products/:id`, `/products/:id/reviews`, `/reviews`, `/orders`, `/newsletter`. Customer endpoints: `/auth/customer`, `/orders/mine`, and review creation. Admin endpoints: `/auth/me`, `/admin/products`, `/admin/orders`, `/admin/users`, and `/admin/dashboard/metrics`.

Orders are Cash on Delivery. The API reads prices from MongoDB, applies 5% tax and Rs. 250 delivery below Rs. 5,000, and adjusts stock conditionally before saving. Order item details are snapshots, so removing a catalog product does not remove its past orders.
