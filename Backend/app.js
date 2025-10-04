const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// Middleware
app.use(morgan('combined'));
// Security headers (fine-tuned; can extend CSP later if needed)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
// Enable CORS with sensible defaults. For production, set CORS_ORIGIN explicitly.
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Middlewares and routes
const { authenticateToken } = require('./middleware/authMiddleware');
const { validateAlatId } = require('./middleware/validateMiddleware');

const dashboardRoutes = require('./routes/dashboard');
const alatRoutes = require('./routes/alat');
const authRoutes = require('./routes/auth');

// Mount routes with /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alat', authenticateToken, alatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Firebase health/config endpoint
const { getConfigStatus, testConnection } = require('./services/firebaseService');
app.get('/api/health/firebase', async (req, res) => {
    try {
        const config = getConfigStatus();
        let connected = false;
        if (config.configured) {
            connected = await testConnection();
        }
        res.json({
            configured: config.configured,
            missing: config.missing,
            databaseURL: config.databaseURL,
            projectId: config.projectId,
            connected
        });
    } catch (err) {
        res.status(500).json({ message: 'Firebase health check failed', error: err.message });
    }
});

// ---------------------------------------------------------------------------
// Static frontend serving (production build integration)
// ---------------------------------------------------------------------------
// Serve the compiled Vite frontend from Frontend/dist when it exists. This
// allows a single deployment unit (same origin for API + assets + Socket.IO).
// We do not interfere with /api or Socket.IO paths. For any non-API request
// that does not match a static file, fall back to index.html (SPA routing).
try {
    const distDir = path.join(__dirname, '../Frontend/dist');
    // Basic existence check; require.main to avoid running during tests
    if (require('fs').existsSync(distDir)) {
        app.use(express.static(distDir, {
            // Let aggressive caching for assets; index.html stays dynamic
            setHeaders: (res, filePath) => {
                if (filePath.endsWith('index.html')) {
                    res.setHeader('Cache-Control', 'no-cache');
                } else if (/\.(js|css|svg|png|ico|jpg|jpeg|webp|avif|woff2?)$/i.test(filePath)) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
            }
        }));
        // SPA fallback: only for GET, not starting with /api or /socket.io
        // Express 5 tightened path-to-regexp; use a regex to match anything not starting with /api or /socket.io
        app.get(/^(?!\/api\/|\/socket\.io\/).*/, (req, res) => {
            return res.sendFile(path.join(distDir, 'index.html'));
        });
        console.log('[static] Serving frontend from', distDir);
    } else {
        console.log('[static] Frontend dist directory not found, skip static serving');
    }
} catch (e) {
    console.warn('[static] Failed to configure static frontend:', e && e.message ? e.message : e);
}

module.exports = app;