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

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});