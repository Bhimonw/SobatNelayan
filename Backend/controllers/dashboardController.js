const db = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// Helpers
function monthKey(year, month) { return `${year}-${String(month).padStart(2, '0')}` }
function eachMonthInclusive(start, end) {
    const out = []
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    const last = new Date(end.getFullYear(), end.getMonth(), 1)
    while (d <= last) {
        out.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
        d.setMonth(d.getMonth() + 1)
    }
    return out
}
function eachDayInclusive(start, end) {
    const out = []
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    while (d <= last) {
        const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0')
        out.push(`${yyyy}-${mm}-${dd}`)
        d.setDate(d.getDate() + 1)
    }
    return out
}

// Statistik total alat, alat aktif, dan lokasi terakhir
async function getDashboardData(req, res) {
    try {
        // Total alat unik
        const alatIds = await db.Livelocation.findAll({
            attributes: ['alatId'],
            group: ['alatId']
        });
        const totalAlat = alatIds.length;

        // Alat aktif (status 'on' dalam 1 jam terakhir)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const aktifAlat = await db.Livelocation.findAll({
            where: {
                status: 'on',
                timestamp: { [Op.gte]: oneHourAgo }
            },
            attributes: ['alatId'],
            group: ['alatId']
        });
        const totalAktif = aktifAlat.length;

        // Lokasi terakhir tiap alat
        const lokasiTerakhir = {};
        for (const alat of alatIds) {
            const lastLoc = await db.Livelocation.findOne({
                where: { alatId: alat.alatId },
                order: [['timestamp', 'DESC']]
            });
            if (lastLoc) {
                lokasiTerakhir[alat.alatId] = {
                    latitude: lastLoc.latitude,
                    longitude: lastLoc.longitude,
                    status: lastLoc.status,
                    timestamp: lastLoc.timestamp
                };
            }
        }

        res.json({
            totalAlat,
            totalAktif,
            lokasiTerakhir
        });
    } catch (err) {
        console.error('getDashboardData error:', err);
        res.status(500).json({ message: 'Error fetching dashboard data', error: err.message });
    }
}

module.exports = { getDashboardData };
// Rekap bulanan penggunaan alat (jumlah status 'on' per alat untuk bulan berjalan)
async function getMonthlyRecap(req, res) {
    try {
        const qMonth = parseInt(req.query.month, 10)
        const qYear = parseInt(req.query.year, 10)
        const base = new Date()
        const year = Number.isFinite(qYear) ? qYear : base.getFullYear()
        const month = Number.isFinite(qMonth) ? qMonth : (base.getMonth() + 1)
        const startDate = new Date(year, month - 1, 1)
        const endDate = new Date(year, month, 0, 23, 59, 59, 999)
        const { fn, col } = db.Sequelize;

        const rows = await db.Livelocation.findAll({
            where: {
                status: 'on',
                timestamp: { [Op.between]: [startDate, endDate] }
            },
            attributes: [
                'alatId',
                [fn('COUNT', col('alatId')), 'usageCount']
            ],
            group: ['alatId'],
            order: [[fn('COUNT', col('alatId')), 'DESC']]
        });

        // Ensure all known alatIds are present with zero if no data this month
        const allAlatRows = await db.Livelocation.findAll({ attributes: ['alatId'], group: ['alatId'] })
        const allAlatIds = allAlatRows.map(r => r.alatId).sort()
        const map = new Map(rows.map(r => [r.alatId, Number(r.get('usageCount'))]))
        const data = allAlatIds
            .map(id => ({ alatId: id, usageCount: map.get(id) || 0 }))
            .sort((a, b) => (b.usageCount - a.usageCount) || String(a.alatId).localeCompare(String(b.alatId)))
        res.json({ month, year, data })
    } catch (err) {
        console.error('getMonthlyRecap error:', err)
        res.status(500).json({ message: 'Error fetching monthly recap', error: err.message })
    }
}

module.exports.getMonthlyRecap = getMonthlyRecap;

// Riwayat bulanan: total 'on' per bulan (global atau per alat)
async function getMonthlyHistory(req, res) {
    try {
        const months = Math.max(1, Math.min(parseInt(req.query.months || '6', 10), 24));
        const alatId = req.query.alatId || null;

        const end = new Date();
        const start = new Date(end);
        start.setMonth(end.getMonth() - (months - 1));
        start.setDate(1); start.setHours(0, 0, 0, 0);

        // MySQL: group by YEAR(timestamp), MONTH(timestamp)
        const where = {
            status: 'on',
            timestamp: { [Op.between]: [start, end] }
        };
        if (alatId) where.alatId = alatId;

        const rows = await db.Livelocation.findAll({
            where,
            attributes: [
                [fn('YEAR', col('timestamp')), 'year'],
                [fn('MONTH', col('timestamp')), 'month'],
                [fn('COUNT', col('id')), 'usageCount']
            ],
            group: [literal('YEAR(`timestamp`)'), literal('MONTH(`timestamp`)')],
            order: [literal('YEAR(`timestamp`) ASC'), literal('MONTH(`timestamp`) ASC')]
        });

        const map = new Map(rows.map(r => [monthKey(Number(r.get('year')), Number(r.get('month'))), Number(r.get('usageCount'))]))
        const padded = eachMonthInclusive(start, end).map(({ year, month }) => ({ year, month, usageCount: map.get(monthKey(year, month)) || 0 }))
        const data = padded
        res.json({ from: start, to: end, alatId: alatId || null, data });
    } catch (err) {
        console.error('getMonthlyHistory error:', err);
        res.status(500).json({ message: 'Error fetching monthly history', error: err.message });
    }
}
module.exports.getMonthlyHistory = getMonthlyHistory;

// Tren harian: total 'on' per hari pada rentang tanggal tertentu (default bulan berjalan)
async function getDailyTrend(req, res) {
    try {
        const alatId = req.query.alatId || null;
        let { start: s, end: e } = req.query;
        const now = new Date();
        const start = s ? new Date(s) : new Date(now.getFullYear(), now.getMonth(), 1);
        const end = e ? new Date(e) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const where = {
            status: 'on',
            timestamp: { [Op.between]: [start, end] }
        };
        if (alatId) where.alatId = alatId;

        // Group by DATE(timestamp)
        const rows = await db.Livelocation.findAll({
            where,
            attributes: [
                [fn('DATE', col('timestamp')), 'day'],
                [fn('COUNT', col('id')), 'usageCount']
            ],
            group: [literal('DATE(`timestamp`)')],
            order: [literal('DATE(`timestamp`) ASC')]
        });
        const map = new Map(rows.map(r => [r.get('day'), Number(r.get('usageCount'))]))
        const padded = eachDayInclusive(start, end).map(day => ({ day, usageCount: map.get(day) || 0 }))
        const data = padded
        res.json({ from: start, to: end, alatId: alatId || null, data });
    } catch (err) {
        console.error('getDailyTrend error:', err);
        res.status(500).json({ message: 'Error fetching daily trend', error: err.message });
    }
}
module.exports.getDailyTrend = getDailyTrend;

// Breakdown status dalam satu bulan (on/off/other)
async function getStatusBreakdown(req, res) {
    try {
        const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const year = parseInt(req.query.year, 10) || (new Date().getFullYear());
        const alatId = req.query.alatId || null;
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const where = { timestamp: { [Op.between]: [start, end] } };
        if (alatId) where.alatId = alatId;

        const rows = await db.Livelocation.findAll({
            where,
            attributes: [
                'status',
                [fn('COUNT', col('id')), 'count']
            ],
            group: ['status'],
            order: [[fn('COUNT', col('id')), 'DESC']]
        });
        const counts = new Map(rows.map(r => [r.status, Number(r.get('count'))]))
        const statuses = Array.from(new Set(['on', 'off', ...rows.map(r => r.status)]))
        const data = statuses.map(s => ({ status: s, count: counts.get(s) || 0 }))
        res.json({ month, year, alatId: alatId || null, data });
    } catch (err) {
        console.error('getStatusBreakdown error:', err);
        res.status(500).json({ message: 'Error fetching status breakdown', error: err.message });
    }
}
module.exports.getStatusBreakdown = getStatusBreakdown;

// Top alat dengan penggunaan terbanyak pada bulan tertentu
async function getTopAlat(req, res) {
    try {
        const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
        const year = parseInt(req.query.year, 10) || (new Date().getFullYear());
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '5', 10), 100));
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);

        const rows = await db.Livelocation.findAll({
            where: {
                status: 'on',
                timestamp: { [Op.between]: [start, end] }
            },
            attributes: [
                'alatId',
                [fn('COUNT', col('id')), 'usageCount']
            ],
            group: ['alatId'],
            order: [[fn('COUNT', col('id')), 'DESC']],
            limit
        });
        const data = rows.map(r => ({ alatId: r.alatId, usageCount: Number(r.get('usageCount')) }));
        res.json({ month, year, limit, data });
    } catch (err) {
        console.error('getTopAlat error:', err);
        res.status(500).json({ message: 'Error fetching top alat', error: err.message });
    }
}
module.exports.getTopAlat = getTopAlat;
