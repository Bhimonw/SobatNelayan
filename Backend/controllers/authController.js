const models = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'sobatnelayan_secret_key'; // Use env var in production
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'sobatnelayan_refresh_secret';

// In-memory store for refresh tokens (for demo). Replace with persistent store in production.
const refreshTokens = new Set();

function generateAccessToken(user) {
    return jwt.sign({ id: user.id, username: user.username, name: user.name }, JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, REFRESH_SECRET, { expiresIn: '7d' });
}

async function login(req, res) {
    const { username, password } = req.body;
    try {
        const user = await models.User.findOne({ where: { username } });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        refreshTokens.add(refreshToken);

        // Set refresh token as HttpOnly cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/api/auth/refresh'
        });

        return res.json({ token: accessToken });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ message: 'Login error', error: err.message });
    }
}

// POST /api/auth/refresh
function refresh(req, res) {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });
    if (!refreshTokens.has(token)) return res.status(403).json({ message: 'Invalid refresh token' });

    jwt.verify(token, REFRESH_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid refresh token' });
        const accessToken = generateAccessToken(user);
        return res.json({ token: accessToken });
    });
}

// POST /api/auth/logout
function logout(req, res) {
    const token = req.cookies?.refreshToken;
    if (token) {
        refreshTokens.delete(token);
        res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    }
    return res.json({ message: 'Logged out' });
}

// GET /api/auth/me
async function me(req, res) {
    try {
        const userId = req.user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const user = await models.User.findByPk(userId, { attributes: ['id', 'name', 'username', 'createdAt', 'updatedAt'] })
        if (!user) return res.status(404).json({ message: 'User not found' })
        return res.json(user)
    } catch (err) {
        console.error('me error:', err)
        return res.status(500).json({ message: 'Failed to fetch user', error: err.message })
    }
}

// PATCH /api/auth/me  { name?, username? }
async function updateMe(req, res) {
    try {
        const userId = req.user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const { name, username } = req.body || {}
        const user = await models.User.findByPk(userId)
        if (!user) return res.status(404).json({ message: 'User not found' })
        if (typeof name !== 'undefined') user.name = String(name)
        if (typeof username !== 'undefined') user.username = String(username)
        await user.save()
        return res.json({ id: user.id, name: user.name, username: user.username, createdAt: user.createdAt, updatedAt: user.updatedAt })
    } catch (err) {
        // Handle unique constraint on username
        if (err?.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Username sudah digunakan' })
        }
        console.error('updateMe error:', err)
        return res.status(500).json({ message: 'Failed to update profile', error: err.message })
    }
}

// PATCH /api/auth/me/password { currentPassword, newPassword }
async function updatePassword(req, res) {
    try {
        const userId = req.user?.id
        if (!userId) return res.status(401).json({ message: 'Unauthorized' })
        const { currentPassword, newPassword } = req.body || {}
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'currentPassword dan newPassword wajib diisi' })
        }
        const user = await models.User.findByPk(userId)
        if (!user) return res.status(404).json({ message: 'User not found' })
        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) return res.status(401).json({ message: 'Password saat ini salah' })
        const hashed = await bcrypt.hash(newPassword, 10)
        user.password = hashed
        await user.save()
        return res.json({ message: 'Password berhasil diubah' })
    } catch (err) {
        console.error('updatePassword error:', err)
        return res.status(500).json({ message: 'Failed to update password', error: err.message })
    }
}

module.exports = { login, refresh, logout, me, updateMe, updatePassword };