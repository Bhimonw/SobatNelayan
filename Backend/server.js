// Live location emission should be driven by real data (Firebase or other source).
const http = require('http');
const app = require('./app');
// Load .env in development (dotenv is in dependencies)
const env = require('./config/env');
const port = env.PORT;

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: env.CORS_ORIGIN,
    }
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
    console.log(`Server is running on http://localhost:${port}`);
});

// ----------------------------------------------------------------------------
// Background poller: read Firebase nodes periodically and emit 'liveLocation'
// events to connected clients. This provides a simple server-side bridge so
// frontends receive live updates even if Firebase isn't pushed directly to the
// server. The poll interval is deliberately short for responsive tracking but
// can be tuned via env or replaced with event listeners for production.
// ----------------------------------------------------------------------------
try {
    const firebaseService = require('./services/firebaseService');
    // last known snapshot of nodes: { [id]: { latitude, longitude, status, ts } }
    let lastSnapshot = {};
    // track last movement time per node (ms since epoch)
    let lastMoveTs = {};
    const db = require('./models');
    const { Op } = require('sequelize');

    async function pollAndEmit() {
        try {
            let nodes = await firebaseService.getAllLocations('/');
            // If firebase not configured or returned no nodes, fallback to DB latest entries
            let usedDbFallback = false;
            if (!nodes || Object.keys(nodes).length === 0) {
                try {
                    // fetch recent livelocation rows (last 24 hours) and pick latest per alatId
                    const since = new Date(Date.now() - (24 * 60 * 60 * 1000));
                    const rows = await db.Livelocation.findAll({
                        where: { timestamp: { [Op.gte]: since } },
                        order: [['timestamp', 'DESC']],
                        limit: 2000
                    });
                    const byAlat = {};
                    for (const r of rows) {
                        if (!byAlat[r.alatId]) byAlat[r.alatId] = r;
                    }
                    const out = {};
                    for (const [k, r] of Object.entries(byAlat)) {
                        out[k] = { latitude: r.latitude, longitude: r.longitude, status: r.status, ts: r.timestamp ? Number(new Date(r.timestamp)) : null };
                    }
                    nodes = out;
                    usedDbFallback = true;
                } catch (dbErr) {
                    // If DB fails, keep nodes as whatever firebase returned (likely empty)
                    console.warn('DB fallback failed while polling for liveLocation:', dbErr && dbErr.message ? dbErr.message : dbErr);
                }
            }
            if (!nodes || typeof nodes !== 'object') return;
            const now = Date.now();
            for (const [id, info] of Object.entries(nodes)) {
                try {
                    const lat = info.latitude ?? null;
                    const lon = info.longitude ?? null;
                    const status = (info.status ?? null);
                    const ts = info.ts ?? info.updatedAt ?? info.lastSeen ?? info.last_update ?? info.timestamp ?? null;
                    // normalize numeric timestamp to ms
                    const tsNum = ts ? (Number(ts) || null) : null;
                    // movement heuristic: if lat/lon unchanged since lastSnapshot for longer than env threshold, mark as 'off'
                    const moveThreshold = (process.env.FIREBASE_OFF_IF_NO_MOVE_MS ? Number(process.env.FIREBASE_OFF_IF_NO_MOVE_MS) : (env.FIREBASE_OFF_IF_NO_MOVE_MS || 10000));
                    const prev = lastSnapshot[id];
                    const coordsChanged = !prev || prev.latitude !== lat || prev.longitude !== lon;
                    if (coordsChanged) {
                        lastMoveTs[id] = Date.now();
                    } else {
                        // no coordinate change; if lastMove exists and it's older than threshold, set status to 'off'
                        const lastMoved = lastMoveTs[id] || (prev && prev.ts ? Number(prev.ts) : null) || null;
                        if (lastMoved && (Date.now() - lastMoved) > moveThreshold) {
                            // override status to 'off' if it wasn't already
                            if (status !== 'off') {
                                // We'll emit an off status below if snapshot changed accordingly
                            }
                        }
                    }
                    const payload = {
                        alatId: id,
                        latitude: lat,
                        longitude: lon,
                        status: status,
                        ts: tsNum || null,
                        source: usedDbFallback ? 'db' : 'firebase'
                    };

                    const prev2 = prev;
                    // Decide effectiveStatus: if coords unchanged for too long, force 'off'
                    let effectiveStatus = status;
                    const moveThresh = (process.env.FIREBASE_OFF_IF_NO_MOVE_MS ? Number(process.env.FIREBASE_OFF_IF_NO_MOVE_MS) : (env.FIREBASE_OFF_IF_NO_MOVE_MS || 10000));
                    const lastMovedAt = lastMoveTs[id] || (prev2 && prev2.ts ? Number(prev2.ts) : null);
                    if (!coordsChanged && lastMovedAt && (Date.now() - lastMovedAt) > moveThresh) {
                        effectiveStatus = 'off';
                    }

                    const changed = !prev2 || prev2.latitude !== lat || prev2.longitude !== lon || String(prev2.status) !== String(effectiveStatus) || (prev2.ts || null) !== (tsNum || null);
                    // Emit when new or changed; also emit periodically (every poll) if previously unknown
                    if (changed) {
                        // update snapshot and emit to all connected sockets
                        lastSnapshot[id] = { latitude: lat, longitude: lon, status: effectiveStatus, ts: tsNum };
                        try {
                            // ensure payload uses effectiveStatus
                            payload.status = effectiveStatus;
                            io.emit('liveLocation', payload);
                            try { publicNs.emit('liveLocation', payload); } catch (e) { /* ignore */ }
                            console.log('Emitted liveLocation for', id, 'src', payload.source, 'lat', lat, 'lon', lon, 'status', payload.status, 'ts', tsNum);
                        } catch (e) {
                            console.warn('Failed to emit liveLocation for', id, e && e.message ? e.message : e);
                        }

                        // Persist to DB so dashboard and history can rely on DB data
                        try {
                            const tsDate = tsNum ? new Date(Number(tsNum)) : new Date();
                            // create a livelocation entry; this is append-only to maintain history
                            await db.Livelocation.create({ alatId: id, latitude: lat, longitude: lon, status: payload.status, timestamp: tsDate });
                        } catch (dbPersistErr) {
                            console.warn('Failed to persist liveLocation to DB for', id, dbPersistErr && dbPersistErr.message ? dbPersistErr.message : dbPersistErr);
                        }
                    }
                } catch (inner) {
                    console.warn('Error processing firebase node', id, inner && inner.message ? inner.message : inner);
                }
            }
        } catch (err) {
            console.warn('Firebase poll error:', err && err.message ? err.message : err);
        }
    }

    // Start polling every 5 seconds (adjust as needed)
    const POLL_MS = process.env.FIREBASE_POLL_MS ? Number(process.env.FIREBASE_POLL_MS) : 5000;
    setInterval(pollAndEmit, POLL_MS);
    // Run once immediately so clients connecting soon after server start receive updates
    setTimeout(pollAndEmit, 500);
} catch (e) {
    console.warn('Firebase emitter not started (service missing or misconfigured):', e && e.message ? e.message : e);
}