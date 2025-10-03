const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

// Read config from env or placeholders
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "YOUR_API_KEY",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "YOUR_DATABASE_URL",
    projectId: process.env.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
    appId: process.env.FIREBASE_APP_ID || "YOUR_APP_ID"
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
        const alatRef = ref(database, `alat/${alatId}/status`);
        const snapshot = await get(alatRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (err) {
        console.error('getAlatStatus error:', err);
        throw err;
    }
}

async function getAlatLocation(alatId) {
    const database = initFirebase();
    if (!database) return null;
    try {
        const locRef = ref(database, `alat/${alatId}/location`);
        const snapshot = await get(locRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (err) {
        console.error('getAlatLocation error:', err);
        throw err;
    }
}

module.exports = {
    getAlatStatus,
    getAlatLocation,
    getConfigStatus,
    testConnection
};
