const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');
const router = express.Router();

router.get('/', authenticateToken, dashboardController.getDashboardData);
router.get('/monthly-recap', authenticateToken, dashboardController.getMonthlyRecap);
router.get('/monthly-history', authenticateToken, dashboardController.getMonthlyHistory);
router.get('/daily-trend', authenticateToken, dashboardController.getDailyTrend);
router.get('/status-breakdown', authenticateToken, dashboardController.getStatusBreakdown);
router.get('/top-alat', authenticateToken, dashboardController.getTopAlat);

module.exports = router;
