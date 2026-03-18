const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  listApplications,
  getApplication,
  applyToJob,
  updateApplicationStatus,
  autoApply,
  getStats,
} = require('../controllers/applicationController');

const router = express.Router();

router.get('/', authenticate, listApplications);
router.get('/stats', authenticate, getStats);
router.get('/:id', authenticate, getApplication);
router.post('/jobs/:id/apply', authenticate, applyToJob);
router.post('/auto-apply', authenticate, autoApply);
router.patch('/:id/status', authenticate, updateApplicationStatus);

module.exports = router;
