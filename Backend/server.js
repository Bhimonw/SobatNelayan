// Contoh: fungsi untuk emit live location ke semua client
function emitLiveLocation(data) {
    io.emit('liveLocation', data);
}

// Contoh: interval untuk emit data dummy setiap 5 detik
setInterval(() => {
    // Data dummy, ganti dengan data dari Firebase
    const data = {
        alatId: 'alat1',
        latitude: -6.2 + Math.random() * 0.01,
        longitude: 106.8 + Math.random() * 0.01,
        status: 'on',
        timestamp: new Date()
    };
    emitLiveLocation(data);
}, 5000);
const http = require('http');
const app = require('./app');
const port = 3000;

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sobatnelayan_secret_key'; // Gunakan env variable di production

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