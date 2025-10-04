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

            // Merge in realtime Firebase nodes (if configured). This supplements DB lokasiTerakhir
            try {
                const firebaseService = require('../services/firebaseService');
                const nodes = await firebaseService.getAllLocations('/');
                if (nodes && typeof nodes === 'object') {
                    for (const [nodeId, info] of Object.entries(nodes)) {
                        // If DB already has a last location for this alatId, keep DB (assumed authoritative)
                        if (!lokasiTerakhir[nodeId]) {
                            lokasiTerakhir[nodeId] = {
                                latitude: info.latitude,
                                longitude: info.longitude,
                                status: info.status || null,
                                // use info.timestamp (Date) if firebaseService provided it, otherwise fall back to info.ts (ms)
                                timestamp: info.timestamp || (info.ts ? new Date(Number(info.ts)) : null)
                            };
                        }
                    }
                }
            } catch (err) {
                console.warn('Could not merge Firebase locations into dashboard:', err.message || err);
            }

            // Debug: log merged lokasiTerakhir keys and samples (temporary)
            try {
                console.log('Dashboard after merge - lokasiTerakhir count:', Object.keys(lokasiTerakhir).length);
                const sampleKeys = Object.keys(lokasiTerakhir).slice(0, 10);
                for (const k of sampleKeys) {
                    const v = lokasiTerakhir[k];
                    console.log('  sample', k, { latitude: v.latitude, longitude: v.longitude, status: v.status, timestamp: v.timestamp });
                }
            } catch (e) {
                console.warn('Failed to log lokasiTerakhir debug info:', e && e.message ? e.message : e);
            }

        // Recompute totals from merged lokasiTerakhir so Firebase-only nodes are counted
        try {
            const env = require('../config/env');
            const now = Date.now();
            // totalAlat is simply the number of keys in lokasiTerakhir (DB + Firebase merged)
            const computedTotalAlat = Object.keys(lokasiTerakhir).length;
            let computedTotalAktif = 0;
            for (const [id, info] of Object.entries(lokasiTerakhir)) {
                // Determine if this entry should be considered 'on'
                const status = info.status ? String(info.status).toLowerCase() : null;
                const ts = info.timestamp ? (Number(new Date(info.timestamp)) || null) : (info.ts ? Number(info.ts) : null);

                let isOn = false;
                if (status === 'on') {
                    // If node explicitly reports 'on', treat it as active even without timestamp
                    isOn = true;
                } else if (!status) {
                    // No explicit status: rely on timestamp freshness or env assumption
                    if (ts) {
                        const ageMinutes = (now - Number(ts)) / 1000 / 60;
                        if (ageMinutes <= (env.FIREBASE_OFF_AFTER_MINUTES || 10)) isOn = true;
                    } else {
                        if (!env.FIREBASE_ASSUME_OFF_IF_NO_TS) isOn = true;
                    }
                }

                if (isOn) computedTotalAktif += 1;
            }

            // Overwrite totals with computed values
            console.log('Dashboard computed totals:', { computedTotalAlat, computedTotalAktif, lokasiCount: Object.keys(lokasiTerakhir).length });
            res.json({ totalAlat: computedTotalAlat, totalAktif: computedTotalAktif, lokasiTerakhir });
            return;
        } catch (totErr) {
            console.warn('Error computing totals from merged lokasiTerakhir, falling back to DB totals:', totErr && totErr.message ? totErr.message : totErr);
            // If something goes wrong, fall back to prior behavior
            res.json({ totalAlat, totalAktif, lokasiTerakhir });
            return;
        }
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

// Return parsed Firebase realtime nodes (for dev/inspection)
async function getFirebaseNodes(req, res) {
    try {
        const firebaseService = require('../services/firebaseService');
        // Use optional query param path (default root)
        const path = req.query.path || '/';
        const nodes = await firebaseService.getAllLocations(path);
        res.json({ path, nodes });
    } catch (err) {
        console.error('getFirebaseNodes error:', err);
        res.status(500).json({ message: 'Error reading Firebase nodes', error: err.message });
    }
}

module.exports.getFirebaseNodes = getFirebaseNodes;

// Return nearest alat to given latitude/longitude (query params) or to configured BUOY coords
async function getNearest(req, res) {
    try {
        // allow optional query lat/lon; otherwise use configured BUOY
        const latQ = req.query.lat ? Number(req.query.lat) : null;
        const lonQ = req.query.lon ? Number(req.query.lon) : null;
        const env = require('../config/env');
        const lat = (latQ !== null && !Number.isNaN(latQ)) ? latQ : env.BUOY_LAT;
        const lon = (lonQ !== null && !Number.isNaN(lonQ)) ? lonQ : env.BUOY_LON;
        if (lat == null || lon == null) return res.status(400).json({ message: 'lat/lon query params or BUOY_LAT/BUOY_LON must be set' });

        // Build merged lokasiTerakhir similarly to getDashboardData
        const lokasiTerakhir = {};
        const alatIds = await db.Livelocation.findAll({ attributes: ['alatId'], group: ['alatId'] });
        for (const alat of alatIds) {
            const lastLoc = await db.Livelocation.findOne({ where: { alatId: alat.alatId }, order: [['timestamp', 'DESC']] });
            if (lastLoc) lokasiTerakhir[alat.alatId] = { latitude: lastLoc.latitude, longitude: lastLoc.longitude, status: lastLoc.status, timestamp: lastLoc.timestamp };
        }
        try {
            const firebaseService = require('../services/firebaseService');
            const nodes = await firebaseService.getAllLocations('/');
            if (nodes && typeof nodes === 'object') {
                for (const [nodeId, info] of Object.entries(nodes)) {
                    if (!lokasiTerakhir[nodeId] && info.latitude != null && info.longitude != null) {
                        lokasiTerakhir[nodeId] = { latitude: info.latitude, longitude: info.longitude, status: info.status || null, timestamp: info.timestamp || (info.ts ? new Date(Number(info.ts)) : null) };
                    }
                }
            }
        } catch (e) {
            // ignore firebase merge errors
        }

        // compute nearest using simple haversine
        function haversine(aLat, aLon, bLat, bLon) {
            const toRad = (v) => v * Math.PI / 180;
            const R = 6371000; // meters
            const dLat = toRad(bLat - aLat);
            const dLon = toRad(bLon - aLon);
            const lat1 = toRad(aLat);
            const lat2 = toRad(bLat);
            const sinDLat = Math.sin(dLat/2);
            const sinDLon = Math.sin(dLon/2);
            const a = sinDLat*sinDLat + sinDLon*sinDLon * Math.cos(lat1) * Math.cos(lat2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        }

        let best = null;
        let bestDist = Infinity;
        for (const [id, loc] of Object.entries(lokasiTerakhir)) {
            if (loc.latitude == null || loc.longitude == null) continue;
            const d = haversine(lat, lon, Number(loc.latitude), Number(loc.longitude));
            if (d < bestDist) { bestDist = d; best = { alatId: id, latitude: Number(loc.latitude), longitude: Number(loc.longitude), status: loc.status, timestamp: loc.timestamp, distanceMeters: d } }
        }
        if (!best) return res.status(404).json({ message: 'No alat locations available' });
        return res.json({ buoy: { lat: lat, lon: lon }, nearest: best });
    } catch (err) {
        console.error('getNearest error:', err);
        res.status(500).json({ message: 'Error computing nearest', error: err.message });
    }
}
module.exports.getNearest = getNearest;
