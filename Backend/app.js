const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(morgan('combined'));
// Enable CORS with sensible defaults. In production, restrict origin as needed.
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

module.exports = app;