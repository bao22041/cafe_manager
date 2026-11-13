// backend/config/db.js
const mysql = require('mysql2/promise');
const path = require('path');

// Ưu tiên biến trên Cloud Dashboard, nếu ở máy local sẽ đọc .env.local rồi đến .env
require('dotenv').config({
    path: [
        path.resolve(__dirname, '../.env.local'),
        path.resolve(__dirname, '../.env')
    ],
    override: false
});

// 1. Đọc chuỗi kết nối từ biến môi trường
const AIVEN_SERVICE_URI = process.env.DATABASE_URL || '';

let parsedUri = null;
if (AIVEN_SERVICE_URI) {
    try {
        parsedUri = new URL(AIVEN_SERVICE_URI);
    } catch (err) {
        console.error('❌ Định dạng DATABASE_URL không hợp lệ:', err.message);
    }
}

// 2. Lấy thông tin kết nối (Ưu tiên tách từ DATABASE_URL, nếu không có thì lấy từng biến rời)
const dbHost = parsedUri?.hostname || process.env.AIVEN_DB_HOST;
const dbPort = Number(parsedUri?.port || process.env.AIVEN_DB_PORT || 10017);
const dbUser = decodeURIComponent(parsedUri?.username || process.env.AIVEN_DB_USER || 'avnadmin');
const dbPassword = decodeURIComponent(parsedUri?.password || '') || process.env.AIVEN_DB_PASSWORD;
const dbName = parsedUri?.pathname?.replace(/^\//, '') || process.env.AIVEN_DB_NAME || 'defaultdb';

// Kiểm tra an toàn trước khi tạo Pool
if (!dbHost || !dbUser || !dbPassword) {
    console.error('❌ Thiếu biến môi trường Database! Hãy nhập DATABASE_URL hoặc AIVEN_DB_HOST / AIVEN_DB_PASSWORD trên trang Deploy.');
    process.exit(1);
}

// 3. Khởi tạo Pool kết nối Aiven MySQL
const createAivenPool = (passwordToUse) => {
    const sslMode = (process.env.AIVEN_SSL_MODE || 'REQUIRED').toUpperCase();

    return mysql.createPool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: passwordToUse,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        ssl: sslMode !== 'DISABLED' ? {
            // Bắt buộc false để tương thích với ssl-mode=REQUIRED của Aiven
            rejectUnauthorized: false
        } : undefined
    });
};

let activePool = createAivenPool(dbPassword);

// Danh sách 12 bảng trên Aiven MySQL (defaultdb)
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

// 4. Kiểm tra kết nối ngay khi khởi động Server
(async () => {
    try {
        const conn = await activePool.getConnection();
        const [tables] = await conn.query('SHOW TABLES');
        console.log(`✅ Đã kết nối Aiven MySQL: ${dbHost}:${dbPort}/${dbName}`);
        console.log(`📦 Số bảng hiện có trên ${dbName}: ${tables.length} bảng`);
        conn.release();
    } catch (err) {
        // Tự động thử mật khẩu dự phòng nếu khai báo AIVEN_DB_PASSWORD_FALLBACK trên trang Deploy
        const fallbackPassword = process.env.AIVEN_DB_PASSWORD_FALLBACK;
        if (err.code === 'ER_ACCESS_DENIED_ERROR' && fallbackPassword && fallbackPassword !== dbPassword) {
            try {
                activePool = createAivenPool(fallbackPassword);
                const connRetry = await activePool.getConnection();
                const [tables] = await connRetry.query('SHOW TABLES');
                console.log(`✅ Đã kết nối Aiven MySQL thành công qua mật khẩu dự phòng (${dbHost}:${dbPort}/${dbName})`);
                console.log(`📦 Số bảng hiện có trên ${dbName}: ${tables.length} bảng`);
                connRetry.release();
            } catch (retryErr) {
                console.error('❌ Lỗi xác thực Aiven MySQL:', retryErr.message);
            }
        } else {
            console.error('❌ Lỗi kết nối Aiven MySQL:', err.message);
        }
    }
})();

module.exports = {
    query: (...args) => activePool.query(...args),
    execute: (...args) => activePool.execute(...args),
    getConnection: () => activePool.getConnection(),
    AIVEN_SERVICE_URI,
    TABLES
};