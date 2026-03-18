/**
 * Feedback Routes
 * Handles user feedback, NPS surveys, and feature request voting.
 */

const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  submitNPS,
  voteFeature,
  listFeatureRequests,
} = require('../controllers/feedbackController');
// const { authenticate } = require('../middleware/auth');

// All feedback routes require authentication
// router.use(authenticate);

// Submit general feedback
router.post('/', submitFeedback);

// Submit NPS survey response
router.post('/nps', submitNPS);

// List feature requests with vote counts
router.get('/features', listFeatureRequests);

// Vote on a feature request
router.post('/features/:id/vote', voteFeature);

module.exports = router;
