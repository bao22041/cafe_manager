// backend/controllers/customerController.js
const pool = require('../config/db');

let isCatalogMigrated = false;
const ensureSeparatedCategories = async () => {
    if (isCatalogMigrated) return;
    try {
        await pool.query(`ALTER TABLE categories ADD COLUMN category_type ENUM('drink', 'food') NOT NULL DEFAULT 'drink'`);
    } catch (e) {}
    try {
        await pool.query(`ALTER TABLE products ADD COLUMN item_type ENUM('drink', 'food') NOT NULL DEFAULT 'drink'`);
    } catch (e) {}
    try {
        const [mixed] = await pool.query(
            `SELECT id FROM categories WHERE name LIKE '%Trà trái cây%' AND name LIKE '%Bánh%'`
        );
        if (mixed.length > 0) {
            const mixedId = mixed[0].id;
            await pool.query(`UPDATE categories SET name = 'Trà trái cây', category_type = 'drink' WHERE id = ?`, [mixedId]);
            const [foodCats] = await pool.query(`SELECT id FROM categories WHERE name LIKE '%Bánh ngọt%' AND name NOT LIKE '%Trà%'`);
            let foodCatId;
            if (foodCats.length === 0) {
                const [ins] = await pool.query(
                    `INSERT INTO categories (name, category_type, is_visible) VALUES ('Bánh ngọt & Đồ ăn nhẹ', 'food', TRUE)`
                );
                foodCatId = ins.insertId;
            } else {
                foodCatId = foodCats[0].id;
            }
            await pool.query(
                `UPDATE products SET category_id = ?, item_type = 'food'
                 WHERE category_id = ? AND (name LIKE '%bánh%' OR name LIKE '%croissant%' OR name LIKE '%tiramisu%' OR description LIKE '%[Đồ ăn]%') AND name NOT LIKE '%trà%'`,
                [foodCatId, mixedId]
            );
        }
        await pool.query(`UPDATE categories SET category_type = 'food' WHERE name LIKE '%bánh%' OR name LIKE '%đồ ăn%'`);
        await pool.query(`UPDATE categories SET category_type = 'drink' WHERE name LIKE '%cà phê%' OR name LIKE '%trà%'`);
        await pool.query(`UPDATE products SET item_type = 'drink' WHERE name LIKE '%trà%' OR name LIKE '%cà phê%' OR name LIKE '%bạc xỉu%'`);
    } catch (e) {}
    isCatalogMigrated = true;
};

exports.getCatalog = async (req, res, next) => {
    const { category_id, min_price, max_price, sort_by, search, include_all } = req.query;
    try {
        await ensureSeparatedCategories();
        const showAllForAdmin = String(include_all) === 'true';

        let sql = `SELECT p.*, 
                          COALESCE(c.name, 'Thực đơn chung') AS category_name,
                          COALESCE(c.category_type, 'drink') AS category_type,
                          COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = p.id), 5.0) AS avg_rating
                   FROM products p
                   LEFT JOIN categories c ON p.category_id = c.id
                   WHERE 1=1`;
        const params = [];

        if (!showAllForAdmin) {
            sql += ` AND p.is_visible = TRUE AND (c.is_visible = TRUE OR c.is_visible IS NULL)`;
        }
        if (category_id) {
            sql += ` AND p.category_id = ?`;
            params.push(category_id);
        }
        if (min_price) {
            sql += ` AND p.base_price >= ?`;
            params.push(Number(min_price));
        }
        if (max_price) {
            sql += ` AND p.base_price <= ?`;
            params.push(Number(max_price));
        }
        if (search) {
            sql += ` AND p.name LIKE ?`;
            params.push(`%${search}%`);
        }

        if (sort_by === 'best_selling') sql += ` ORDER BY p.sold_count DESC`;
        else if (sort_by === 'price_asc') sql += ` ORDER BY p.base_price ASC`;
        else if (sort_by === 'price_desc') sql += ` ORDER BY p.base_price DESC`;
        else sql += ` ORDER BY p.id DESC`;

        const [products] = await pool.query(sql, params);
        const [categories] = await pool.query(
            showAllForAdmin
                ? `SELECT * FROM categories ORDER BY category_type ASC, id ASC`
                : `SELECT * FROM categories WHERE is_visible = TRUE ORDER BY category_type ASC, id ASC`
        );
        const [options] = await pool.query(`SELECT * FROM product_options`);
        const [tables] = await pool.query(
            `SELECT t.*, a.name AS area_name FROM cafe_tables t JOIN areas a ON t.area_id = a.id ORDER BY t.id ASC`
        );
        const [areas] = await pool.query(`SELECT * FROM areas`);
        const [vouchers] = await pool.query(
            `SELECT * FROM vouchers
             WHERE is_active = TRUE AND expires_at >= NOW()
             ORDER BY min_order_value ASC, discount_value DESC`
        );

        res.json({ categories, products, options, tables, areas, vouchers });
    } catch (err) {
        next(err);
    }
};

exports.getProductDetail = async (req, res, next) => {
    try {
        const [[product]] = await pool.query(
            `SELECT p.*, c.name AS category_name, c.category_type FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
            [req.params.id]
        );
        if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm!' });

        const [reviews] = await pool.query(
            `SELECT r.*, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ? ORDER BY r.created_at DESC`,
            [req.params.id]
        );
        const [options] = await pool.query(`SELECT * FROM product_options`);
        res.json({ product, reviews, options });
    } catch (err) {
        next(err);
    }
};

exports.validateVoucher = async (req, res, next) => {
    const { code, order_total } = req.body;
    try {
        const [rows] = await pool.query(
            `SELECT * FROM vouchers
             WHERE code = ?
               AND is_active = TRUE
               AND (starts_at IS NULL OR starts_at <= NOW())
               AND expires_at >= NOW()`,
            [code?.trim().toUpperCase()]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Mã giảm giá không tồn tại, chưa tới ngày mở hoặc đã hết hạn!' });
        }
        const v = rows[0];
        if (Number(order_total) < Number(v.min_order_value)) {
            return res.status(400).json({
                message: `Đơn tối thiểu ${Number(v.min_order_value).toLocaleString('vi-VN')}đ mới được áp dụng mã này!`
            });
        }
        res.json({ voucher: v });
    } catch (err) {
        next(err);
    }
};

exports.getReviews = async (req, res, next) => {
    try {
        const [reviews] = await pool.query(
            `SELECT r.*, u.full_name, p.name AS product_name
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             JOIN products p ON r.product_id = p.id
             ORDER BY r.created_at DESC`
        );
        res.json(reviews);
    } catch (err) {
        next(err);
    }
};

exports.createReview = async (req, res, next) => {
    const { product_id, order_id, rating, comment } = req.body;
    try {
        if (!product_id || !order_id) {
            return res.status(400).json({ message: 'Thiếu thông tin món hoặc mã đơn hàng!' });
        }
        const [existing] = await pool.query(
            `SELECT id FROM reviews WHERE user_id = ? AND order_id = ? AND product_id = ?`,
            [req.user.id, order_id, product_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Món này trong đơn hàng đã được bạn đánh giá rồi!' });
        }

        const [result] = await pool.query(
            `INSERT INTO reviews (user_id, product_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, product_id, order_id, Number(rating) || 5, comment || '']
        );

        const io = req.app.get('io');
        if (io) {
            io.emit('GLOBAL_SYNC', {
                event: 'NEW_REVIEW_SUBMITTED',
                orderId: Number(order_id),
                productId: Number(product_id)
            });
        }

        res.status(201).json({
            message: 'Cảm ơn bạn đã gửi đánh giá!',
            reviewId: result.insertId,
            product_id: Number(product_id),
            order_id: Number(order_id)
        });
    } catch (err) {
        next(err);
    }
};