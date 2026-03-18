const winston = require('winston');
const config = require('./config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    config.logging.format === 'json' ? winston.format.json() : winston.format.simple(),
  ),
  defaultMeta: { service: 'quickhire' },
  transports: [
    new winston.transports.Console({
      format:
        config.env === 'development'
          ? winston.format.combine(winston.format.colorize(), winston.format.simple())
          : winston.format.json(),
    }),
  ],
});

if (config.logging.toFile) {
  logger.add(
    new winston.transports.File({
      filename: `${config.logging.filePath}/error.log`,
      level: 'error',
    }),
  );
  logger.add(
    new winston.transports.File({
      filename: `${config.logging.filePath}/combined.log`,
    }),
  );
}

module.exports = logger;
