const express = require('express');
const alatController = require('../controllers/alatController');
const { validateAlatId } = require('../middleware/validateMiddleware');
const router = express.Router();

router.get('/:alatId/statistik', validateAlatId, alatController.getMonthlyUsage);
router.get('/:alatId/status', validateAlatId, alatController.getStatus);
router.get('/:alatId/location', validateAlatId, alatController.getLocation);

module.exports = router;
