// backend/config/db.js
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');

// ========================================
// 1. LOAD ENVIRONMENT
// Thứ tự ưu tiên: Railway Variables > .env.local > .env
// ========================================
dotenv.config({
    path: path.resolve(__dirname, '../.env.local'),
    override: false
});

dotenv.config({
    path: path.resolve(__dirname, '../.env'),
    override: false
});

// ========================================
// 2. READ DATABASE CONFIG
// ========================================
const AIVEN_SERVICE_URI = (
    process.env.DATABASE_URL ||
    process.env.AIVEN_DATABASE_URL ||
    process.env.AIVEN_DB_URL ||
    ''
).trim();

let parsedUri = null;

if (AIVEN_SERVICE_URI) {
    try {
        parsedUri = new URL(AIVEN_SERVICE_URI);

        if (!['mysql:', 'mysql2:'].includes(parsedUri.protocol)) {
            throw new Error('DATABASE_URL phải sử dụng giao thức mysql://');
        }
    } catch (error) {
        throw new Error(`DATABASE_URL không hợp lệ: ${error.message}`);
    }
}

const dbHost = (parsedUri?.hostname || process.env.AIVEN_DB_HOST || '').trim();

const dbPort = Number(
    parsedUri?.port ||
    process.env.AIVEN_DB_PORT ||
    10017
);

const dbUser = decodeURIComponent(
    parsedUri?.username ||
    process.env.AIVEN_DB_USER ||
    'avnadmin'
).trim();

const dbPassword = (
    decodeURIComponent(parsedUri?.password || '') ||
    process.env.AIVEN_DB_PASSWORD ||
    ''
).trim();

const dbName = (
    parsedUri?.pathname?.replace(/^\/+/, '') ||
    process.env.AIVEN_DB_NAME ||
    'defaultdb'
).trim();

const sslMode = (
    process.env.AIVEN_SSL_MODE ||
    parsedUri?.searchParams.get('ssl-mode') ||
    'REQUIRED'
).trim().toUpperCase();

// ========================================
// 3. VALIDATE CONFIGURATION
// ========================================
if (!dbHost || !dbUser || !dbPassword || !dbName) {
    throw new Error(
        'Thiếu cấu hình Aiven MySQL. ' +
        'Kiểm tra DATABASE_URL hoặc AIVEN_DB_HOST, ' +
        'AIVEN_DB_USER, AIVEN_DB_PASSWORD, AIVEN_DB_NAME.'
    );
}

if (!Number.isInteger(dbPort) || dbPort <= 0 || dbPort > 65535) {
    throw new Error('AIVEN_DB_PORT không hợp lệ.');
}

if (!['REQUIRED', 'DISABLED'].includes(sslMode)) {
    throw new Error('AIVEN_SSL_MODE chỉ được là REQUIRED hoặc DISABLED.');
}

// ========================================
// 4. DATABASE TABLE CONSTANTS
// ========================================
const TABLES = {
    USERS: 'users',
    AREAS: 'areas',
    CAFE_TABLES: 'cafe_tables',
    CATEGORIES: 'categories',
    PRODUCTS: 'products',
    PRODUCT_OPTIONS: 'product_options',
    INGREDIENTS: 'ingredients',
    PRODUCT_RECIPES: 'product_recipes',
    VOUCHERS: 'vouchers',
    ORDERS: 'orders',
    ORDER_ITEMS: 'order_items',
    REVIEWS: 'reviews'
};

// ========================================
// 5. CREATE MYSQL POOL
// ========================================
const createAivenPool = (password) => {
    return mysql.createPool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        connectTimeout: 20000,
        ssl: sslMode === 'REQUIRED'
            ? { rejectUnauthorized: false }
            : undefined
    });
};

let activePool = createAivenPool(dbPassword);
let initialized = false;

// ========================================
// 6. TEST DATABASE CONNECTION
// ========================================
const initialize = async () => {
    if (initialized) return;

    let connection;

    try {
        connection = await activePool.getConnection();
        await connection.query('SELECT 1');
        const [tables] = await connection.query('SHOW TABLES');

        console.log('===================================');
        console.log('✅ AIVEN MYSQL CONNECTED');
        console.log(`Host: ${dbHost}`);
        console.log(`Port: ${dbPort}`);
        console.log(`Database: ${dbName}`);
        console.log(`Tables: ${tables.length}`);
        console.log('===================================');

        initialized = true;
    } catch (error) {
        if (
            error.code === 'ER_ACCESS_DENIED_ERROR' &&
            process.env.AIVEN_DB_PASSWORD_FALLBACK &&
            process.env.AIVEN_DB_PASSWORD_FALLBACK !== dbPassword
        ) {
            console.log('⚠️ Thử kết nối bằng mật khẩu dự phòng...');

            try {
                if (connection) {
                    connection.release();
                    connection = null;
                }

                await activePool.end();
                activePool = createAivenPool(process.env.AIVEN_DB_PASSWORD_FALLBACK.trim());
                connection = await activePool.getConnection();
                await connection.query('SELECT 1');

                console.log('✅ Aiven MySQL connected using fallback password.');
                initialized = true;
            } catch (retryError) {
                throw new Error(`Aiven fallback connection failed: ${retryError.message}`);
            }
        } else {
            throw new Error(`Aiven MySQL connection failed: ${error.message}`);
        }
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// ========================================
// 7. EXPORT DATABASE
// ========================================
module.exports = {
    initialize,
    query: (...args) => activePool.query(...args),
    execute: (...args) => activePool.execute(...args),
    getConnection: () => activePool.getConnection(),
    end: () => activePool.end(),
    AIVEN_SERVICE_URI,
    TABLES
};