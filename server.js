require('dotenv').config();

const app = require('./src/app');
const connectDatabase = require('./src/config/database');

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
  }

  await connectDatabase();
  const server = app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received; closing server.`);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Unable to start server:', error.message);
  process.exit(1);
});
