// backend/sockets/socketManager.js
const jwt = require('jsonwebtoken');

module.exports = (io) => {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next();
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch (err) {
            next();
        }
    });

    io.on('connection', (socket) => {
        if (socket.user) {
            socket.join(`role_${socket.user.role}`);
            socket.join(`user_${socket.user.id}`);
        }

        socket.on('TRACK_ORDER', (orderId) => {
            if (orderId) socket.join(`order_${orderId}`);
        });

        socket.on('disconnect', () => {});
    });
};