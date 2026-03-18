const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  listSavedJobs,
  saveJob,
  updateSavedJob,
  removeSavedJob,
  getSavedJobStats,
  bulkAutoApply,
} = require('../controllers/savedJobsController');

const router = express.Router();

router.get('/', authenticate, listSavedJobs);
router.get('/stats', authenticate, getSavedJobStats);
router.post('/', authenticate, saveJob);
router.post('/bulk-apply', authenticate, bulkAutoApply);
router.patch('/:id', authenticate, updateSavedJob);
router.delete('/:id', authenticate, removeSavedJob);

module.exports = router;
