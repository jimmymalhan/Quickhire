const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./utils/config');
const { assignRequestId, httpLogger } = require('./api/middleware/requestLogger');
const { apiLimiter } = require('./api/middleware/rateLimit');
const errorHandler = require('./api/middleware/errorHandler');
const routes = require('./api/routes');

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));

// Request processing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging & identification
app.use(assignRequestId);
if (config.env !== 'test') {
  app.use(httpLogger);
}

// Rate limiting
app.use('/api/', apiLimiter);

// Routes
app.use('/api', routes);

// Root health check
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'quickhire-api', version: '0.0.1-alpha' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    code: 404,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
