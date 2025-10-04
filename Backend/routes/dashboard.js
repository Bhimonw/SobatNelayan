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
router.get('/firebase-nodes', authenticateToken, dashboardController.getFirebaseNodes);
// Dev-only public endpoint for quick inspection (disabled in production)
if (process.env.NODE_ENV !== 'production') {
	router.get('/firebase-nodes-public', dashboardController.getFirebaseNodes);
}
// nearest endpoint (authenticated); also expose a dev public version
router.get('/nearest', authenticateToken, dashboardController.getNearest);
if (process.env.NODE_ENV !== 'production') {
    router.get('/nearest-public', dashboardController.getNearest);
}

module.exports = router;
