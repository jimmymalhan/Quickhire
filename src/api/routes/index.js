const express = require('express');
const { healthCheck } = require('../controllers/healthController');
const authRoutes = require('./auth');
const jobRoutes = require('./jobs');
const applicationRoutes = require('./applications');
const settingsRoutes = require('./settings');
const feedbackRoutes = require('./feedback');
const runtimeRoutes = require('./runtime');

const router = express.Router();

router.get('/health', healthCheck);
router.use('/auth', authRoutes);
router.use('/jobs', jobRoutes);
router.use('/applications', applicationRoutes);
router.use('/settings', settingsRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/runtime', runtimeRoutes);

module.exports = router;
