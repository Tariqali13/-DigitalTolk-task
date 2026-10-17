const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const responseTime = require('response-time');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const config = require('./config');
const db = require('./config/database');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(responseTime());
app.use(express.json({ limit: '1mb' }));

if (config.env !== 'test') {
  app.use(morgan('dev'));
}

app.get('/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ success: true, message: 'Server is up and running' });
});

const swaggerDocument = YAML.parse(fs.readFileSync(path.join(__dirname, 'docs/swagger.yaml'), 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
