const mongoose = require('mongoose');
const { config } = require('./config');

let connectionPromise;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  if (!config.mongoUri) throw new Error('MONGODB_URI is required');

  connectionPromise = mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000
  }).then(() => mongoose.connection).catch((error) => {
    connectionPromise = undefined;
    throw error;
  });

  return connectionPromise;
}

module.exports = { connectToDatabase };
