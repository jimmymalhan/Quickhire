const express = require('express');
const {
  getRuntimeProgress,
  streamRuntimeProgress,
  getRuntimeControl,
  updateRuntimeControl,
  queueRuntimeCommand,
  handleRuntimePrompt,
  updateCommandStatus,
  getWorkerStatus,
} = require('../controllers/runtimeController');

const router = express.Router();

router.get('/', getRuntimeProgress);
router.get('/snapshot', getRuntimeProgress);
router.get('/progress', getRuntimeProgress);
router.get('/stream', streamRuntimeProgress);
router.get('/control', getRuntimeControl);
router.patch('/control', updateRuntimeControl);
router.post('/control', handleRuntimePrompt);
router.post('/commands', queueRuntimeCommand);
router.patch('/commands/:id', updateCommandStatus);
router.get('/worker', getWorkerStatus);

module.exports = router;
