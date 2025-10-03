const db = require('../models');
const { Op } = require('sequelize');
// Statistik penggunaan alat per bulan
async function getMonthlyUsage(req, res) {
    const alatId = req.params.alatId;
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    try {
        const count = await db.Livelocation.count({
            where: {
                alatId,
                status: 'on',
                timestamp: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });
        res.json({ alatId, month: now.getMonth() + 1, year: now.getFullYear(), usageCount: count });
    } catch (err) {
        console.error('getMonthlyUsage error:', err);
        res.status(500).json({ message: 'Error fetching monthly usage', error: err.message });
    }
}
const firebaseService = require('../services/firebaseService');

// Contoh: alatId bisa didapat dari query atau path
async function getStatus(req, res) {
    const alatId = req.params.alatId;
    try {
        const status = await firebaseService.getAlatStatus(alatId);
        res.json({ alatId, status });
    } catch (err) {
        console.error('getStatus error:', err);
        res.status(500).json({ message: 'Error fetching alat status', error: err.message });
    }
}

async function getLocation(req, res) {
    const alatId = req.params.alatId;
    try {
        const location = await firebaseService.getAlatLocation(alatId);
        res.json({ alatId, location });
    } catch (err) {
        console.error('getLocation error:', err);
        res.status(500).json({ message: 'Error fetching alat location', error: err.message });
    }
}

module.exports = {
    getStatus,
    getLocation
    , getMonthlyUsage
};
