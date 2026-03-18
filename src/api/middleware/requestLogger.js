const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

const assignRequestId = (req, _res, next) => {
  req.id = uuidv4();
  next();
};

const httpLogger = morgan('combined', { stream });

module.exports = { assignRequestId, httpLogger };
