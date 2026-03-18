'use strict';

const express = require('express');
const {
  chat,
  listAgentsHandler,
  getAgentHealth,
  getAgentById,
} = require('../controllers/agentsController');

const router = express.Router();

router.post('/chat', chat);
router.get('/health', getAgentHealth);
router.get('/', listAgentsHandler);
router.get('/:id', getAgentById);

module.exports = router;
