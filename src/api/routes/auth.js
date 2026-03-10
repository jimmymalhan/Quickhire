const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
  getLinkedInAuthUrl,
  handleOAuthCallback,
  refreshToken,
  getProfile,
  logout,
} = require('../controllers/authController');

const router = express.Router();

router.get('/login', authLimiter, getLinkedInAuthUrl);
router.get('/callback', authLimiter, handleOAuthCallback);
router.post('/refresh', authLimiter, refreshToken);
router.get('/profile', authenticate, getProfile);
router.post('/logout', authenticate, logout);

module.exports = router;
