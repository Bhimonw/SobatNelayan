const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
// Ensure centralized env is loaded so scripts and server see same values
const env = require('../config/env');

function parseTimestampAny(ts) {
    if (!ts && ts !== 0) return null;
    // numeric string or number
    const n = Number(ts);
    if (!Number.isNaN(n) && isFinite(n)) {
        // If timestamp looks like seconds (10 digits) convert to ms
        if (n > 0 && n < 1e12) return n * 1000;
        return n;
    }
    // Try ISO/Date parse
    const d = Date.parse(String(ts));
    if (!Number.isNaN(d)) return d;
    return null;
}

// Read config from centralized env loader or placeholders
const firebaseConfig = {
    apiKey: env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: env.FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
    databaseURL: env.FIREBASE_DATABASE_URL || "YOUR_DATABASE_URL",
    projectId: env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: env.FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
    messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
    appId: env.FIREBASE_APP_ID || "YOUR_APP_ID"
};

let db = null;
function initFirebase() {
    if (db) return db;
    const dbUrl = firebaseConfig.databaseURL;
    // If databaseURL is not configured properly, skip initialization
    if (!dbUrl || dbUrl.includes('YOUR_DATABASE_URL')) {
        console.warn('Firebase not configured (missing or placeholder databaseURL). firebaseService will return null results.');
        return null;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        return db;
    } catch (err) {
        console.error('Error initializing Firebase:', err);
        return null;
    }
}

function getConfigStatus() {
    const required = [
        'apiKey',
        'authDomain',
        'databaseURL',
        'projectId',
        'storageBucket',
        'messagingSenderId',
        'appId'
    ];
    const missing = required.filter((k) => {
        const v = firebaseConfig[k];
        return !v || String(v).includes('YOUR_');
    });
    return {
        configured: missing.length === 0,
        missing,
        databaseURL: firebaseConfig.databaseURL || null,
        projectId: firebaseConfig.projectId || null
    };
}

async function testConnection() {
    const database = initFirebase();
    if (!database) return false;
    try {
        // Try a very light read; .info/connected is maintained by client
        const snap = await get(ref(database, '.info/connected'));
        // If SDK returns something, we consider connectivity OK
        return snap.exists();
    } catch (err) {
        console.error('Firebase connectivity test failed:', err.message || err);
        return false;
    }
}

async function getAlatStatus(alatId) {
    const database = initFirebase();
    if (!database) return null;
    try {
        // Try legacy path first
        const alatRef = ref(database, `alat/${alatId}/status`);
        const snapshot = await get(alatRef);
        if (snapshot.exists()) return snapshot.val();

        // Fallback: if node exists at root (e.g. /node1 with lat/long), treat presence as 'on'
        const nodeRef = ref(database, `${alatId}`);
        const nodeSnap = await get(nodeRef);
        if (nodeSnap.exists()) {
            const val = nodeSnap.val();
            // If node has explicit status, return it (normalize)
            if (val && val.status !== undefined) return String(val.status).toLowerCase();

            // If node has lat/long field, use freshness heuristic to determine online/offline
            const hasLat = val && (val.lat !== undefined || val.latitude !== undefined);
            if (hasLat) {
                // Attempt to read a timestamp field
                const ts = val.ts ?? val.updatedAt ?? val.lastSeen ?? val.last_update ?? val.timestamp ?? null;
                if (ts) {
                    const tsNum = Number(ts);
                    if (!Number.isNaN(tsNum)) {
                        const ageMinutes = (Date.now() - tsNum) / 1000 / 60;
                        if (ageMinutes > (env.FIREBASE_OFF_AFTER_MINUTES || 10)) return 'off';
                        return 'on';
                    }
                }
                // No timestamp available — respect env flag to assume off or on
                return env.FIREBASE_ASSUME_OFF_IF_NO_TS ? 'off' : 'on';
            }
        }
        return null;
    } catch (err) {
        console.error('getAlatStatus error:', err);
        throw err;
    }
}

async function getAlatLocation(alatId) {
    const database = initFirebase();
    if (!database) return null;
    try {
        // Try legacy path first
        const locRef = ref(database, `alat/${alatId}/location`);
        const snapshot = await get(locRef);
        if (snapshot.exists()) return snapshot.val();

        // Fallback: read node at root which may have { lat, long } or { latitude, longitude }
        const nodeRef = ref(database, `${alatId}`);
        const nodeSnap = await get(nodeRef);
        if (nodeSnap.exists()) {
            const node = nodeSnap.val();
            const latitude = node.latitude ?? node.lat ?? null;
            const longitude = node.longitude ?? node.long ?? node.lng ?? null;
            if (latitude !== null && longitude !== null) {
                return { latitude: Number(latitude), longitude: Number(longitude) };
            }
            // If the node contains nested location object
            if (node.location && node.location.lat !== undefined) {
                return { latitude: Number(node.location.lat), longitude: Number(node.location.long ?? node.location.lng ?? node.location.longitude) };
            }
        }
        return null;
    } catch (err) {
        console.error('getAlatLocation error:', err);
        throw err;
    }
}

// Read all nodes under a given path (default root) and map to { alatId, latitude, longitude, status }
async function getAllLocations(path = '/') {
    const database = initFirebase();
    if (!database) return null;
    try {
        const rootRef = ref(database, path);
        const snapshot = await get(rootRef);
        if (!snapshot.exists()) return {};
        const val = snapshot.val();
        const out = {};
        // val expected to be an object with child nodes
        if (typeof val === 'object') {
            for (const [key, node] of Object.entries(val)) {
                if (!node || typeof node !== 'object') continue;
                const latitude = node.latitude ?? node.lat ?? null;
                const longitude = node.longitude ?? node.long ?? node.lng ?? null;

                // Determine status with heuristics
                let status = null;
                if (node.status !== undefined && node.status !== null) {
                    status = String(node.status).toLowerCase();
                } else if (latitude !== null && longitude !== null) {
                    // Try to use timestamp fields if present
                    const ts = node.ts ?? node.updatedAt ?? node.lastSeen ?? node.last_update ?? node.timestamp ?? null;
                    if (ts) {
                        const tsNum = Number(ts);
                        if (!Number.isNaN(tsNum)) {
                            const ageMinutes = (Date.now() - tsNum) / 1000 / 60;
                            status = ageMinutes > (env.FIREBASE_OFF_AFTER_MINUTES || 10) ? 'off' : 'on';
                        } else {
                            status = env.FIREBASE_ASSUME_OFF_IF_NO_TS ? 'off' : 'on';
                        }
                    } else {
                        // No timestamp available — use assume-off flag
                        status = env.FIREBASE_ASSUME_OFF_IF_NO_TS ? 'off' : 'on';
                    }
                }

                if (latitude !== null && longitude !== null) {
                    // Parse any timestamp-like fields into ms since epoch
                    const rawTs = node.ts ?? node.updatedAt ?? node.lastSeen ?? node.last_update ?? node.timestamp ?? null;
                    const parsedTs = parseTimestampAny(rawTs);
                    // Provide both 'ts' (ms) and 'timestamp' (Date object) for downstream compatibility
                    out[key] = { latitude: Number(latitude), longitude: Number(longitude), status, ts: parsedTs, timestamp: parsedTs ? new Date(parsedTs) : null };
                }
            }
        }
        return out;
    } catch (err) {
        console.error('getAllLocations error:', err);
        throw err;
    }
}

module.exports = {
    getAlatStatus,
    getAlatLocation,
    getAllLocations,
    getConfigStatus,
    testConnection
};
