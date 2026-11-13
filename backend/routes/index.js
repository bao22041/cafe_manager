// backend/routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

const authRoutes = require('./auth.routes');
const customerRoutes = require('./customer.routes');
const posKdsRoutes = require('./posKds.routes');
const adminRoutes = require('./admin.routes');

// API test nhanh trạng thái kết nối Aiven và số bản ghi của cả 11 bảng trên defaultdb
router.get('/health-db', async (req, res, next) => {
    try {
        const counts = {};
        for (const tableName of Object.values(db.TABLES)) {
            const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM ${tableName}`);
            counts[tableName] = row.total;
        }
        res.json({
            status: 'CONNECTED_TO_AIVEN_MYSQL',
            database: 'defaultdb',
            tables_row_count: counts
        });
    } catch (err) {
        next(err);
    }
});

router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/', posKdsRoutes);
router.use('/admin', adminRoutes);

module.exports = router;