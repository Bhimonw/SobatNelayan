// Live location emission should be driven by real data (Firebase or other source).
const http = require('http');
const app = require('./app');
// Load .env in development (dotenv is in dependencies)
const env = require('./config/env');
const port = env.PORT;

const server = http.createServer(app);
const { Server } = require('socket.io');
// Support multiple allowed origins (comma separated) for CORS / Socket.IO
let allowedOrigins = env.CORS_ORIGIN;
if (typeof allowedOrigins === 'string' && allowedOrigins.includes(',')) {
    allowedOrigins = allowedOrigins.split(',').map(o => o.trim()).filter(Boolean);
}
if (env.NODE_ENV === 'production' && (allowedOrigins === '*' || (Array.isArray(allowedOrigins) && allowedOrigins.includes('*')))) {
    console.warn('[SECURITY] CORS_ORIGIN is wildcard in production. Set CORS_ORIGIN to your domain, e.g. https://app.sobatnelayan.id');
}

const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
    path: env.SOCKET_PATH || '/socket.io'
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = env.JWT_SECRET; // centralized

io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return next(new Error('Authentication error: Invalid token'));
        socket.user = user;
        next();
    });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id, 'User:', socket.user.username);
    // Contoh emit event
    // socket.emit('liveLocation', { alatId: 'alat1', latitude: -6.2, longitude: 106.8 });
});

// Public namespace: no auth required, useful for map viewers that don't have tokens
const publicNs = io.of('/public');
publicNs.on('connection', (socket) => {
    console.log('Public client connected:', socket.id);
    socket.on('disconnect', () => console.log('Public client disconnected:', socket.id));
});

server.listen(port, () => {
    // Prefer explicit PUBLIC_BASE_URL (or ORIGIN) if provided for accurate logging in container/proxy setups
    const publicBase = process.env.PUBLIC_BASE_URL || process.env.APP_ORIGIN || `http://localhost:${port}`;
    console.log(`Server is running on ${publicBase} (socket path: ${env.SOCKET_PATH || '/socket.io'})`);
});

// ----------------------------------------------------------------------------
// Background poller: read Firebase nodes periodically and emit 'liveLocation'
// events to connected clients. This provides a simple server-side bridge so
// frontends receive live updates even if Firebase isn't pushed directly to the
// server. The poll interval is deliberately short for responsive tracking but
// can be tuned via env or replaced with event listeners for production.
// ----------------------------------------------------------------------------
try {
    const useListener = process.env.FIREBASE_USE_LISTENER === '1' || process.env.FIREBASE_USE_LISTENER === 'true';
    if (useListener) {
        console.log('Starting real-time Firebase listener bridge (FIREBASE_USE_LISTENER=1)');
        const { startListener } = require('./services/liveLocationBridge');
        startListener(io, publicNs);
    } else {
        console.log('Using legacy polling bridge (set FIREBASE_USE_LISTENER=1 to enable real-time listeners)');
        // Keep existing poller for backward compatibility
        const firebaseService = require('./services/firebaseService');
    let lastSnapshot = {};
    let lastMoveTs = {};
    let lastPersistTs = {};
        const db = require('./models');
        const { Op } = require('sequelize');
        async function pollAndEmit() {
            try {
                let nodes = await firebaseService.getAllLocations('/');
                let usedDbFallback = false;
                if (!nodes || Object.keys(nodes).length === 0) {
                    try {
                        const since = new Date(Date.now() - (24 * 60 * 60 * 1000));
                        const rows = await db.Livelocation.findAll({
                            where: { timestamp: { [Op.gte]: since } },
                            order: [['timestamp', 'DESC']],
                            limit: 2000
                        });
                        const byAlat = {};
                        for (const r of rows) { if (!byAlat[r.alatId]) byAlat[r.alatId] = r; }
                        const out = {};
                        for (const [k, r] of Object.entries(byAlat)) {
                            out[k] = { latitude: r.latitude, longitude: r.longitude, status: r.status, ts: r.timestamp ? Number(new Date(r.timestamp)) : null };
                        }
                        nodes = out;
                        usedDbFallback = true;
                    } catch (dbErr) {
                        console.warn('DB fallback failed while polling for liveLocation:', dbErr && dbErr.message ? dbErr.message : dbErr);
                    }
                }
                if (!nodes || typeof nodes !== 'object') return;
                for (const [id, info] of Object.entries(nodes)) {
                    try {
                        const lat = info.latitude ?? null;
                        const lon = info.longitude ?? null;
                        const status = (info.status ?? null);
                        const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null;
                        const tsNum = ts ? (Number(ts) || null) : null;
                        const moveThreshold = (process.env.FIREBASE_OFF_IF_NO_MOVE_MS ? Number(process.env.FIREBASE_OFF_IF_NO_MOVE_MS) : (env.FIREBASE_OFF_IF_NO_MOVE_MS || 10000));
                        const prev = lastSnapshot[id];
                        const coordsChanged = !prev || prev.latitude !== lat || prev.longitude !== lon;
                        if (coordsChanged) {
                            lastMoveTs[id] = Date.now();
                        } else {
                            const lastMoved = lastMoveTs[id] || (prev && prev.ts ? Number(prev.ts) : null) || null;
                            if (lastMoved && (Date.now() - lastMoved) > moveThreshold) {
                                // will force off below
                            }
                        }
                        let effectiveStatus = status;
                        const lastMovedAt = lastMoveTs[id] || (prev && prev.ts ? Number(prev.ts) : null);
                        if (!coordsChanged && lastMovedAt && (Date.now() - lastMovedAt) > moveThreshold) effectiveStatus = 'off';
                        const changed = !prev || prev.latitude !== lat || prev.longitude !== lon || String(prev.status) !== String(effectiveStatus) || (prev.ts || null) !== (tsNum || null);
                        if (changed) {
                            const throttleMs = env.LIVELOCATION_DB_THROTTLE_MS || 0;
                            const isMinor = prev && prev.latitude === lat && prev.longitude === lon && prev.status === effectiveStatus;
                            const now = Date.now();
                            const skipDb = throttleMs > 0 && isMinor && (now - (lastPersistTs[id] || 0)) < throttleMs;
                            lastSnapshot[id] = { latitude: lat, longitude: lon, status: effectiveStatus, ts: tsNum };
                            const payload = { alatId: id, latitude: lat, longitude: lon, status: effectiveStatus, ts: tsNum || null, source: usedDbFallback ? 'db' : 'firebase' };
                            try { io.emit('liveLocation', payload); publicNs.emit('liveLocation', payload); } catch {}
                            if (!skipDb) {
                                try { await db.Livelocation.create({ alatId: id, latitude: lat, longitude: lon, status: effectiveStatus, timestamp: tsNum ? new Date(tsNum) : new Date() }); lastPersistTs[id] = now; } catch (persistErr) { console.warn('Persist failed for', id, persistErr.message || persistErr); }
                            }
                        }
                    } catch (inner) { console.warn('Error processing firebase node', id, inner && inner.message ? inner.message : inner); }
                }
            } catch (err) {
                console.warn('Firebase poll error:', err && err.message ? err.message : err);
            }
        }
        const POLL_MS = process.env.FIREBASE_POLL_MS ? Number(process.env.FIREBASE_POLL_MS) : 5000;
        setInterval(pollAndEmit, POLL_MS);
        setTimeout(pollAndEmit, 500);
        // Metrics logging
        if (env.LIVELOCATION_METRICS_INTERVAL_MS && env.LIVELOCATION_METRICS_INTERVAL_MS > 0) {
            setInterval(() => {
                try {
                    const total = Object.keys(lastSnapshot).length;
                    let onCount = 0; let offCount = 0;
                    for (const v of Object.values(lastSnapshot)) { if (v.status === 'on') onCount++; else offCount++; }
                    console.log(`[poll metrics] total=${total} on=${onCount} off=${offCount}`);
                } catch {}
            }, env.LIVELOCATION_METRICS_INTERVAL_MS);
        }
        // Retention purge (align with listener retention if enabled)
        if (env.LIVELOCATION_RETENTION_DAYS && env.LIVELOCATION_RETENTION_DAYS > 0) {
            const RET_MS = env.LIVELOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
            setInterval(async () => {
                try {
                    const cutoff = new Date(Date.now() - RET_MS);
                    const { Op } = require('sequelize');
                    const deleted = await db.Livelocation.destroy({ where: { timestamp: { [Op.lt]: cutoff } } });
                    if (deleted > 0) console.log(`[poll retention] purged ${deleted} old rows (< ${cutoff.toISOString()})`);
                } catch (e) {
                    console.warn('Poll retention purge failed', e.message || e);
                }
            }, 60 * 60 * 1000);
        }
    }
} catch (e) {
    console.warn('Live location bridge failed to start:', e && e.message ? e.message : e);
}