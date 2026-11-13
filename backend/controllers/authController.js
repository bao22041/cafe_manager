// backend/controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ROLE_REDIRECT_MAP } = require('../config/constants');

exports.register = async (req, res, next) => {
    const { full_name, email, phone, password } = req.body;
    try {
        const cleanEmail = email.trim().toLowerCase();
        const [exist] = await db.query('SELECT id FROM users WHERE email = ? OR phone = ?', [cleanEmail, phone]);
        if (exist.length > 0) return res.status(400).json({ message: 'Email hoặc số điện thoại đã tồn tại!' });

        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer')`,
            [full_name.trim(), cleanEmail, phone, hash]
        );

        const io = req.app.get('io');
        if (io) io.emit('GLOBAL_SYNC', { event: 'CUSTOMER_REGISTERED', userId: result.insertId });

        res.status(201).json({ message: 'Đăng ký thành công!', userId: result.insertId });
    } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email.trim().toLowerCase()]);
        if (rows.length === 0) return res.status(401).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa!' });

        const user = rows[0];
        const storedHash = user.password_hash || '';
        const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$');
        const match = isBcrypt ? await bcrypt.compare(password, storedHash) : password === storedHash;

        if (!match) return res.status(401).json({ message: 'Mật khẩu không chính xác!' });

        const token = jwt.sign(
            { id: user.id, role: user.role, full_name: user.full_name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                membership_tier: user.membership_tier,
                loyalty_points: user.loyalty_points
            },
            targetRoute: ROLE_REDIRECT_MAP[user.role]
        });
    } catch (err) { next(err); }
};

exports.googleOAuth = async (req, res, next) => {
    const { email, full_name, google_id } = req.body;
    try {
        let [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        let user;
        if (rows.length === 0) {
            const [ins] = await db.query(
                `INSERT INTO users (full_name, email, google_id, role) VALUES (?, ?, ?, 'customer')`,
                [full_name, email, google_id]
            );
            const [newRows] = await db.query('SELECT * FROM users WHERE id = ?', [ins.insertId]);
            user = newRows[0];
        } else {
            user = rows[0];
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, full_name: user.full_name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.json({ token, user, targetRoute: ROLE_REDIRECT_MAP[user.role] });
    } catch (err) { next(err); }
};

exports.getProfileAndHistory = async (req, res, next) => {
    try {
        const [[profile]] = await db.query(
            'SELECT id, full_name, email, phone, role, membership_tier, loyalty_points FROM users WHERE id = ?',
            [req.user.id]
        );
        const [orders] = await db.query(
            `SELECT o.*, t.table_number 
             FROM orders o 
             LEFT JOIN cafe_tables t ON o.table_id = t.id 
             WHERE o.customer_id = ? 
             ORDER BY o.created_at DESC LIMIT 20`,
            [req.user.id]
        );
        for (const ord of orders) {
            const [items] = await db.query(
                `SELECT oi.*, p.name,
                        EXISTS(
                            SELECT 1 FROM reviews r 
                            WHERE r.order_id = oi.order_id 
                              AND r.product_id = oi.product_id 
                              AND r.user_id = ?
                        ) AS is_reviewed
                 FROM order_items oi 
                 JOIN products p ON oi.product_id = p.id 
                 WHERE oi.order_id = ?`,
                [req.user.id, ord.id]
            );
            ord.items = items.map((it) => ({
                ...it,
                is_reviewed: Boolean(it.is_reviewed)
            }));
        }
        res.json({ profile, orders });
    } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
    const { full_name, phone } = req.body;
    try {
        await db.query(`UPDATE users SET full_name = ?, phone = ? WHERE id = ?`, [full_name, phone, req.user.id]);
        res.json({ message: 'Cập nhật hồ sơ cá nhân thành công!' });
    } catch (err) { next(err); }
};