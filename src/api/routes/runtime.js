const express = require('express');
const {
  getRuntimeProgress,
  streamRuntimeProgress,
} = require('../controllers/runtimeController');

const router = express.Router();

router.get('/progress', getRuntimeProgress);
router.get('/stream', streamRuntimeProgress);

module.exports = router;
