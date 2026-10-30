const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { config } = require('./config');
const { requireAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const { router: productRoutes } = require('./routes/products');
const orderRoutes = require('./routes/orders').router;
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
if (config.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin is not allowed by CORS');
    error.status = 403;
    return callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', requireAuth('admin'), adminRoutes);

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.name === 'ZodError') {
    return res.status(400).json({ message: error.issues[0]?.message || 'Invalid request' });
  }
  if (error?.name === 'ValidationError') {
    return res.status(400).json({ message: error.message });
  }
  if (error?.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier' });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ message: 'A record with these details already exists' });
  }
  if (error?.status === 403 || error?.message === 'Origin is not allowed by CORS') {
    return res.status(403).json({ message: 'Origin is not allowed' });
  }
  if (config.nodeEnv !== 'production') console.error(error);
  return res.status(error?.status || 500).json({
    message: error?.status && error.status < 500 ? error.message : 'Internal server error'
  });
});

module.exports = app;
