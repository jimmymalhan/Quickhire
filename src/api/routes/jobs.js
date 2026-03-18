const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  searchJobs,
  getJobById,
  triggerJobScrape,
  getRecommendations,
} = require('../controllers/jobController');

const router = express.Router();

router.get('/search', authenticate, searchJobs);
router.get('/scrape', authenticate, triggerJobScrape);
router.get('/recommendations', authenticate, getRecommendations);
router.get('/:id', authenticate, getJobById);

module.exports = router;
