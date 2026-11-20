// backend/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');

// Thứ tự ưu tiên: Railway Variables > .env.local > .env
dotenv.config({
    path: path.resolve(__dirname, '.env.local'),
    override: false
});

dotenv.config({
    path: path.resolve(__dirname, '.env'),
    override: false
});

const db = require('./config/db');
const routes = require('./routes');
const socketManager = require('./sockets/socketManager');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Danh sách origin được phép gọi API & Socket
const defaultOrigins = [
    'http://localhost:5173',
    'https://cafe-manager-web.onrender.com'
];

const envOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const frontendOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));
const allowAllOrigins = envOrigins.includes('*');

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (allowAllOrigins || frontendOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Hỗ trợ ảnh món ăn dạng Base64
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Socket.io: ưu tiên polling trước websocket để vượt qua proxy cloud ổn định
const io = new Server(server, {
    cors: corsOptions,
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingInterval: 25000,
    pingTimeout: 60000
});

app.set('io', io);
socketManager(io);

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Cafe Management Backend API is online',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Cafe Management Backend is running',
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

const databaseHealthCheck = async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.status(200).json({
            success: true,
            server: 'OK',
            database: 'CONNECTED',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Database health check failed:', error.message);
        res.status(503).json({
            success: false,
            server: 'OK',
            database: 'DISCONNECTED'
        });
    }
};

app.get('/api/health', databaseHealthCheck);
app.get('/api/health-db', databaseHealthCheck);

app.use('/api', routes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('Server error:', err.message);

    if (typeof errorMiddleware === 'function') {
        return errorMiddleware(err, req, res, next);
    }

    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

const PORT = Number(process.env.PORT) || 5000;
let isShuttingDown = false;

async function startServer() {
    try {
        console.log('===================================');
        console.log('☕ CAFE MANAGEMENT SYSTEM');
        console.log('Starting backend...');
        console.log('===================================');

        await db.initialize();

        server.listen(PORT, '0.0.0.0', () => {
            console.log('===================================');
            console.log('🚀 BACKEND STARTED SUCCESSFULLY');
            console.log(`PORT: ${PORT}`);
            console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
            console.log('DATABASE: CONNECTED');
            console.log('SOCKET.IO: READY');
            console.log('===================================');
        });
    } catch (error) {
        console.error('❌ BACKEND STARTUP FAILED');
        console.error(error.message);

        await db.end().catch(() => {});
        process.exit(1);
    }
}

async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`${signal} received. Shutting down...`);

    server.close(async () => {
        try {
            await db.end();
            console.log('Database connections closed.');
            process.exit(0);
        } catch (error) {
            console.error('Shutdown error:', error.message);
            process.exit(1);
        }
    });

    setTimeout(() => {
        console.error('Forced shutdown.');
        process.exit(1);
    }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();