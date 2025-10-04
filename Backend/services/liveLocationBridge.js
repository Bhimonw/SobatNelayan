// Real-time live location bridge using Firebase Realtime Database listeners.
// Falls back gracefully if Firebase not configured.
// Responsibilities:
//  - Listen to root (or configured path) value changes.
//  - Emit socket.io 'liveLocation' events immediately for changed/added nodes.
//  - Apply movement + freshness heuristics (consistent with existing poller logic).
//  - Persist only meaningful changes to DB (append history rows).
//  - Background watchdog marks devices OFF if no movement beyond threshold.

const env = require('../config/env');
const firebaseService = require('./firebaseService');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onValue } = require('firebase/database');
const dbModels = require('../models');

// We re-use timestamp parsing logic loosely similar to firebaseService
function parseTs(ts) {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isNaN(n) && isFinite(n)) {
    if (n > 0 && n < 1e12) return n * 1000; // seconds to ms
    return n;
  }
  const d = Date.parse(String(ts));
  return Number.isNaN(d) ? null : d;
}

let started = false;
let listenerDb = null;
let lastSnapshot = {}; // id -> { latitude, longitude, status, ts }
let lastMoveTs = {};   // id -> epoch ms when movement last detected

// Heuristic thresholds
const MOVE_THRESHOLD = env.FIREBASE_OFF_IF_NO_MOVE_MS || 10000;
// Freshness threshold (minutes) used when status missing but timestamp exists
const FRESH_MINUTES = env.FIREBASE_OFF_AFTER_MINUTES || 10;
// Watchdog interval (ms) configurable
const OFFLINE_CHECK_INTERVAL_MS = process.env.OFFLINE_CHECK_INTERVAL_MS ? Number(process.env.OFFLINE_CHECK_INTERVAL_MS) : 5000;

function effectiveStatusFor(node, prev, id) {
  // Determine base status from raw node
  let status = null;
  if (node.status !== undefined && node.status !== null) {
    status = String(node.status).toLowerCase();
  }
  const latitude = node.latitude ?? node.lat ?? null;
  const longitude = node.longitude ?? node.long ?? node.lng ?? null;
  const rawTs = node.ts ?? node.updatedAt ?? node.lastSeen ?? node.last_update ?? node.timestamp ?? null;
  const tsNum = parseTs(rawTs);
  if (!status && latitude != null && longitude != null) {
    if (tsNum) {
      const ageMinutes = (Date.now() - tsNum) / 60000;
      status = ageMinutes > FRESH_MINUTES ? 'off' : 'on';
    } else {
      status = env.FIREBASE_ASSUME_OFF_IF_NO_TS ? 'off' : 'on';
    }
  }
  // Movement heuristic override
  const prevEntry = prev || lastSnapshot[id];
  let coordsChanged = false;
  if (prevEntry) {
    coordsChanged = prevEntry.latitude !== latitude || prevEntry.longitude !== longitude;
  } else if (latitude != null && longitude != null) {
    coordsChanged = true; // new node
  }
  if (coordsChanged) {
    lastMoveTs[id] = Date.now();
  }
  const lastMovedAt = lastMoveTs[id] || (prevEntry && prevEntry.ts) || null;
  if (!coordsChanged && lastMovedAt && (Date.now() - lastMovedAt) > MOVE_THRESHOLD) {
    status = 'off';
  }
  return { status: status || null, tsNum };
}

async function persistIfChanged(io, publicNs, id, latitude, longitude, status, tsNum, source) {
  const prev = lastSnapshot[id];
  const changed = !prev || prev.latitude !== latitude || prev.longitude !== longitude || String(prev.status) !== String(status) || (prev.ts || null) !== (tsNum || null);
  if (!changed) return;
  lastSnapshot[id] = { latitude, longitude, status, ts: tsNum };
  const payload = { alatId: id, latitude, longitude, status, ts: tsNum || null, source };
  try { io.emit('liveLocation', payload); } catch {}
  try { publicNs.emit('liveLocation', payload); } catch {}
  try {
    await dbModels.Livelocation.create({ alatId: id, latitude, longitude, status, timestamp: tsNum ? new Date(tsNum) : new Date() });
  } catch (e) {
    console.warn('liveLocationBridge DB persist failed for', id, e.message || e);
  }
}

function startListener(io, publicNs) {
  if (started) return;
  started = true;
  // re-use firebaseService config; ensure it's properly configured
  const cfgStatus = firebaseService.getConfigStatus();
  if (!cfgStatus.configured) {
    console.warn('liveLocationBridge: Firebase not fully configured, listener disabled. Missing:', cfgStatus.missing.join(','));
    return;
  }
  try {
    // Use same initialization path as firebaseService (it will internally init) OR create new app instance
    const firebaseConfig = {
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      databaseURL: env.FIREBASE_DATABASE_URL,
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
      appId: env.FIREBASE_APP_ID
    };
    const app = initializeApp(firebaseConfig, 'listener-app');
    listenerDb = getDatabase(app);
  } catch (e) {
    console.warn('liveLocationBridge: failed to init Firebase app for listener', e.message || e);
    return;
  }

  const rootRef = ref(listenerDb, '/');
  console.log('liveLocationBridge: starting real-time listener on root');
  onValue(rootRef, async (snapshot) => {
    try {
      if (!snapshot.exists()) return;
      const val = snapshot.val();
      if (typeof val !== 'object') return;
      for (const [id, node] of Object.entries(val)) {
        if (!node || typeof node !== 'object') continue;
        const latitude = node.latitude ?? node.lat ?? null;
        const longitude = node.longitude ?? node.long ?? node.lng ?? null;
        if (latitude == null || longitude == null) continue;
        const { status, tsNum } = effectiveStatusFor(node, lastSnapshot[id], id);
        persistIfChanged(io, publicNs, id, Number(latitude), Number(longitude), status || 'off', tsNum, 'firebase-listener');
      }
    } catch (e) {
      console.warn('liveLocationBridge snapshot processing error', e.message || e);
    }
  }, (err) => {
    console.warn('liveLocationBridge listener error', err.message || err);
  });

  // Watchdog: periodically check movement stagnation and emit OFF if stale
  setInterval(() => {
    try {
      const now = Date.now();
      for (const [id, snap] of Object.entries(lastSnapshot)) {
        const lastMoved = lastMoveTs[id] || snap.ts || null;
        if (!lastMoved) continue;
        if (now - lastMoved > MOVE_THRESHOLD) {
          if (snap.status !== 'off') {
            // Force update to off
            persistIfChanged(io, publicNs, id, snap.latitude, snap.longitude, 'off', snap.ts, 'watchdog');
          }
        }
      }
    } catch (e) { /* ignore */ }
  }, OFFLINE_CHECK_INTERVAL_MS);
}

module.exports = {
  startListener
};