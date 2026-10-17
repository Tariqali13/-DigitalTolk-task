const app = require('./app');
const config = require('./config');
const { pool } = require('./config/database');

const server = app.listen(config.port, () => {
  console.log(`Server is running on http://localhost:${config.port}`);
  console.log(`Swagger docs: http://localhost:${config.port}/api-docs`);
});

const shutdown = () => {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
