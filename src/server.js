const mongoose = require('mongoose');
const app = require('./app');
const { config, validateRuntimeConfig } = require('./config');

async function start() {
  validateRuntimeConfig();
  await mongoose.connect(config.mongoUri);
  const server = app.listen(config.port, () => {
    console.log(`E-commerce API listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Unable to start the API:', error.message);
  process.exitCode = 1;
});
