const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.me);
router.patch('/me', authenticateToken, authController.updateMe);
router.patch('/me/password', authenticateToken, authController.updatePassword);

module.exports = router;
