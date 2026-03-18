const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getSettings,
  updateSettings,
  getNotificationSettings,
} = require('../controllers/settingsController');

const router = express.Router();

router.get('/', authenticate, getSettings);
router.patch('/', authenticate, updateSettings);
router.get('/notifications', authenticate, getNotificationSettings);

module.exports = router;
