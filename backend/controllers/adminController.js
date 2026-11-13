// backend/controllers/adminController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Nhận diện tên danh mục thuộc nhóm Bánh ngọt / Đồ ăn
const detectFoodCategoryName = (catName = '') => {
    const text = String(catName).toLowerCase();
    if (text.includes('trà') && !text.includes('bánh')) return false;
    const foodKeywords = ['bánh', 'đồ ăn', 'thức ăn', 'ăn vặt', 'snack', 'bakery', 'pastry', 'food', 'điểm tâm'];
    return foodKeywords.some((kw) => text.includes(kw));
};

// Tự động kiểm tra, nâng cấp cấu trúc bảng & tách riêng danh mục "Trà trái cây" và "Bánh ngọt"
let isSchemaEnsured = false;
const ensureSchemaColumns = async () => {
    if (isSchemaEnsured) return;
    try {
        await db.query(`ALTER TABLE products MODIFY COLUMN image_url LONGTEXT NULL`);
    } catch (e) {}
    try {
        const [pCols] = await db.query(`SHOW COLUMNS FROM products LIKE 'item_type'`);
        if (pCols.length === 0) {
            await db.query(`ALTER TABLE products ADD COLUMN item_type ENUM('drink', 'food') NOT NULL DEFAULT 'drink' AFTER image_url`);
        }
    } catch (e) {}
    try {
        const [cCols] = await db.query(`SHOW COLUMNS FROM categories LIKE 'category_type'`);
        if (cCols.length === 0) {
            await db.query(`ALTER TABLE categories ADD COLUMN category_type ENUM('drink', 'food') NOT NULL DEFAULT 'drink' AFTER name`);
        }
    } catch (e) {}
    try {
        const [vCols] = await db.query(`SHOW COLUMNS FROM vouchers LIKE 'starts_at'`);
        if (vCols.length === 0) {
            await db.query(`ALTER TABLE vouchers ADD COLUMN starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER required_tier`);
        }
    } catch (e) {}

    // Tự động tách danh mục "Trà trái cây & Bánh ngọt" nếu vẫn còn gộp chung trong DB
    try {
        const [mixedCats] = await db.query(
            `SELECT id, name FROM categories WHERE name LIKE '%Trà trái cây%' AND name LIKE '%Bánh%'`
        );
        if (mixedCats.length > 0) {
            const mixedCatId = mixedCats[0].id;
            await db.query(
                `UPDATE categories SET name = 'Trà trái cây', category_type = 'drink' WHERE id = ?`,
                [mixedCatId]
            );

            const [foodCats] = await db.query(
                `SELECT id FROM categories WHERE name LIKE '%Bánh ngọt%' AND name NOT LIKE '%Trà%'`
            );
            let foodCatId;
            if (foodCats.length === 0) {
                const [insFoodCat] = await db.query(
                    `INSERT INTO categories (name, category_type, is_visible) VALUES ('Bánh ngọt & Đồ ăn nhẹ', 'food', TRUE)`
                );
                foodCatId = insFoodCat.insertId;
            } else {
                foodCatId = foodCats[0].id;
                await db.query(`UPDATE categories SET category_type = 'food' WHERE id = ?`, [foodCatId]);
            }

            await db.query(
                `UPDATE products 
                 SET category_id = ?, item_type = 'food'
                 WHERE category_id = ? 
                   AND (name LIKE '%bánh%' OR name LIKE '%croissant%' OR name LIKE '%tiramisu%' OR name LIKE '%mousse%' OR description LIKE '%[Đồ ăn]%')
                   AND name NOT LIKE '%trà%'`,
                [foodCatId, mixedCatId]
            );
        }

        await db.query(`UPDATE categories SET category_type = 'food' WHERE name LIKE '%bánh%' OR name LIKE '%đồ ăn%' OR name LIKE '%ăn vặt%'`);
        await db.query(`UPDATE categories SET category_type = 'drink' WHERE name LIKE '%cà phê%' OR name LIKE '%trà%' OR name LIKE '%sinh tố%'`);

        await db.query(
            `UPDATE products SET item_type = 'drink', description = REPLACE(description, '[Đồ ăn] ', '')
             WHERE name LIKE '%trà%' OR name LIKE '%cà phê%' OR name LIKE '%cafe%' OR name LIKE '%bạc xỉu%'`
        );
        await db.query(
            `UPDATE products p JOIN categories c ON p.category_id = c.id
             SET p.item_type = 'food'
             WHERE c.category_type = 'food' AND p.name NOT LIKE '%trà%' AND p.name NOT LIKE '%cà phê%'`
        );
    } catch (e) {}

    isSchemaEnsured = true;
};

// Phát sự kiện đồng bộ Real-time từ Admin sang Customer, POS và KDS
const broadcastAdminSync = (req, eventName, extra = {}) => {
    const io = req.app.get('io');
    if (!io) return;
    const payload = { event: eventName, timestamp: Date.now(), ...extra };
    io.emit('GLOBAL_SYNC', payload);
    io.to('role_admin').emit('ADMIN_DATA_UPDATED', payload);
    io.to('role_cashier').to('role_waiter').emit('TABLE_MAP_UPDATED', payload);
};

// ============================================================================
// 1. BẢNG CATEGORIES, PRODUCTS & PRODUCT_OPTIONS (QUẢN LÝ MENU & HÌNH ẢNH MÓN)
// ============================================================================
exports.saveCategory = async (req, res, next) => {
    const { id, name, category_type, is_visible } = req.body;
    try {
        await ensureSchemaColumns();
        const cleanName = (name || '').trim();
        if (!cleanName) return res.status(400).json({ message: 'Tên danh mục không được để trống!' });

        const lowerName = cleanName.toLowerCase();
        if (lowerName.includes('trà') && lowerName.includes('bánh')) {
            return res.status(400).json({
                message: 'Không được gộp chung Trà và Bánh ngọt vào cùng 1 danh mục! Vui lòng tạo 2 danh mục riêng biệt.'
            });
        }

        const finalCatType =
            category_type === 'food' || category_type === 'drink'
                ? category_type
                : detectFoodCategoryName(cleanName)
                ? 'food'
                : 'drink';

        if (id) {
            await db.query(
                `UPDATE categories SET name = ?, category_type = ?, is_visible = ? WHERE id = ?`,
                [cleanName, finalCatType, is_visible !== undefined ? Boolean(is_visible) : true, id]
            );
        } else {
            await db.query(
                `INSERT INTO categories (name, category_type, is_visible) VALUES (?, ?, ?)`,
                [cleanName, finalCatType, is_visible !== undefined ? Boolean(is_visible) : true]
            );
        }
        broadcastAdminSync(req, 'CATEGORY_SAVED');
        res.json({ message: 'Đã lưu danh mục & phân loại thành công!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteCategory = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM categories WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'CATEGORY_DELETED', { categoryId: Number(req.params.id) });
        res.json({ message: 'Đã xóa danh mục!' });
    } catch (err) {
        next(err);
    }
};

exports.saveProduct = async (req, res, next) => {
    const {
        id,
        category_id,
        name,
        description,
        base_price,
        calories,
        image_url,
        item_type,
        is_food,
        is_available,
        is_visible
    } = req.body;

    try {
        await ensureSchemaColumns();

        const cleanName = (name || '').trim();
        if (!cleanName) {
            return res.status(400).json({ message: 'Vui lòng nhập tên món!' });
        }

        const isFoodItem = Boolean(is_food || item_type === 'food');
        const targetType = isFoodItem ? 'food' : 'drink';

        const [catRows] = await db.query(`SELECT id, name, category_type FROM categories ORDER BY id ASC`);
        let validCategoryId = Number(category_id);
        let selectedCat = catRows.find((c) => Number(c.id) === validCategoryId);

        if (!selectedCat || selectedCat.category_type !== targetType) {
            const matchingCat = catRows.find((c) => c.category_type === targetType);
            if (matchingCat) {
                validCategoryId = matchingCat.id;
            } else {
                const defaultCatName = isFoodItem ? 'Bánh ngọt & Đồ ăn nhẹ' : 'Trà trái cây';
                const [insCat] = await db.query(
                    `INSERT INTO categories (name, category_type, is_visible) VALUES (?, ?, TRUE)`,
                    [defaultCatName, targetType]
                );
                validCategoryId = insCat.insertId;
            }
        }

        await db.query(`UPDATE categories SET is_visible = TRUE WHERE id = ?`, [validCategoryId]);

        let cleanDesc = (description || '').trim();
        if (isFoodItem) {
            if (!cleanDesc.toLowerCase().includes('đồ ăn') && !cleanName.toLowerCase().includes('bánh')) {
                cleanDesc = cleanDesc ? `[Đồ ăn] ${cleanDesc}` : '[Đồ ăn] Phục vụ theo cái';
            }
        } else {
            cleanDesc = cleanDesc.replace(/^\[Đồ ăn\]\s*/gi, '').trim();
        }

        const defaultDrinkImg = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80';
        const defaultFoodImg = 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80';
        const cleanImageUrl = (image_url || '').trim() || (isFoodItem ? defaultFoodImg : defaultDrinkImg);

        const availableFlag = is_available !== undefined ? (is_available ? 1 : 0) : 1;
        const visibleFlag = is_visible !== undefined ? (is_visible ? 1 : 0) : 1;
        let savedProductId = id ? Number(id) : null;

        if (savedProductId) {
            await db.query(
                `UPDATE products
                 SET category_id = ?,
                     name = ?,
                     description = ?,
                     base_price = ?,
                     calories = ?,
                     image_url = ?,
                     item_type = ?,
                     is_available = ?,
                     is_visible = ?
                 WHERE id = ?`,
                [
                    validCategoryId,
                    cleanName,
                    cleanDesc,
                    Number(base_price) || 0,
                    Number(calories) || 120,
                    cleanImageUrl,
                    targetType,
                    availableFlag,
                    visibleFlag,
                    savedProductId
                ]
            );
        } else {
            const [insProd] = await db.query(
                `INSERT INTO products (category_id, name, description, base_price, calories, image_url, item_type, is_available, is_visible)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    validCategoryId,
                    cleanName,
                    cleanDesc,
                    Number(base_price) || 0,
                    Number(calories) || 120,
                    cleanImageUrl,
                    targetType,
                    availableFlag,
                    visibleFlag
                ]
            );
            savedProductId = insProd.insertId;
        }

        const [[savedProduct]] = await db.query(
            `SELECT p.*, c.name AS category_name, c.category_type
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ?`,
            [savedProductId]
        );

        broadcastAdminSync(req, 'PRODUCT_SAVED', { productId: savedProductId });
        res.json({
            message: id ? 'Đã cập nhật món & phân loại danh mục thành công!' : 'Đã thêm món mới vào đúng danh mục!',
            product: savedProduct
        });
    } catch (err) {
        next(err);
    }
};

exports.deleteProduct = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM products WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'PRODUCT_DELETED', { productId: Number(req.params.id) });
        res.json({ message: 'Đã xóa sản phẩm!' });
    } catch (err) {
        next(err);
    }
};

exports.getProductOptions = async (req, res, next) => {
    try {
        const [options] = await db.query(`SELECT * FROM product_options ORDER BY option_group, id`);
        res.json(options);
    } catch (err) {
        next(err);
    }
};

exports.saveProductOption = async (req, res, next) => {
    const { id, option_group, option_name, extra_price } = req.body;
    try {
        if (id) {
            await db.query(
                `UPDATE product_options SET option_group = ?, option_name = ?, extra_price = ? WHERE id = ?`,
                [option_group, option_name, extra_price || 0, id]
            );
        } else {
            await db.query(
                `INSERT INTO product_options (option_group, option_name, extra_price) VALUES (?, ?, ?)`,
                [option_group, option_name, extra_price || 0]
            );
        }
        broadcastAdminSync(req, 'PRODUCT_OPTION_SAVED');
        res.json({ message: 'Đã lưu tùy chọn món (product_options)!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteProductOption = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM product_options WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'PRODUCT_OPTION_DELETED');
        res.json({ message: 'Đã xóa tùy chọn món!' });
    } catch (err) {
        next(err);
    }
};

// ============================================================================
// 2. BẢNG AREAS & CAFE_TABLES (SƠ ĐỒ BÀN & KHU VỰC)
// ============================================================================
exports.saveArea = async (req, res, next) => {
    const { id, name, description } = req.body;
    try {
        if (id) {
            await db.query(`UPDATE areas SET name = ?, description = ? WHERE id = ?`, [name, description || '', id]);
        } else {
            await db.query(`INSERT INTO areas (name, description) VALUES (?, ?)`, [name, description || '']);
        }
        broadcastAdminSync(req, 'AREA_SAVED');
        res.json({ message: 'Đã lưu khu vực (areas)!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteArea = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM areas WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'AREA_DELETED');
        res.json({ message: 'Đã xóa khu vực!' });
    } catch (err) {
        next(err);
    }
};

exports.saveTable = async (req, res, next) => {
    const { id, area_id, table_number, capacity, status } = req.body;
    try {
        if (id) {
            await db.query(
                `UPDATE cafe_tables SET area_id = ?, table_number = ?, capacity = ?, status = ? WHERE id = ?`,
                [area_id, table_number, capacity || 4, status || 'empty', id]
            );
        } else {
            await db.query(
                `INSERT INTO cafe_tables (area_id, table_number, capacity, status) VALUES (?, ?, ?, ?)`,
                [area_id, table_number, capacity || 4, status || 'empty']
            );
        }
        broadcastAdminSync(req, 'TABLE_SAVED');
        res.json({ message: 'Đã lưu bàn (cafe_tables)!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteTable = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM cafe_tables WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'TABLE_DELETED');
        res.json({ message: 'Đã xóa bàn!' });
    } catch (err) {
        next(err);
    }
};

// ============================================================================
// 3. BẢNG INGREDIENTS & PRODUCT_RECIPES (KHO NGUYÊN LIỆU & ĐỊNH LƯỢNG BOM)
// ============================================================================
exports.getInventory = async (req, res, next) => {
    try {
        const [ingredients] = await db.query(`SELECT * FROM ingredients ORDER BY stock_quantity ASC`);
        const [recipes] = await db.query(
            `SELECT r.*, p.name AS product_name, i.name AS ingredient_name, i.unit
             FROM product_recipes r
             JOIN products p ON r.product_id = p.id
             JOIN ingredients i ON r.ingredient_id = i.id`
        );
        res.json({ ingredients, recipes });
    } catch (err) {
        next(err);
    }
};

exports.saveIngredient = async (req, res, next) => {
    const { id, name, unit, stock_quantity, min_threshold } = req.body;
    try {
        if (id) {
            await db.query(
                `UPDATE ingredients SET name = ?, unit = ?, stock_quantity = ?, min_threshold = ? WHERE id = ?`,
                [name, unit, stock_quantity, min_threshold, id]
            );
        } else {
            await db.query(
                `INSERT INTO ingredients (name, unit, stock_quantity, min_threshold) VALUES (?, ?, ?, ?)`,
                [name, unit, stock_quantity, min_threshold]
            );
        }
        broadcastAdminSync(req, 'INGREDIENT_SAVED');
        res.json({ message: 'Đã lưu nguyên liệu (ingredients)!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteIngredient = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM ingredients WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'INGREDIENT_DELETED');
        res.json({ message: 'Đã xóa nguyên liệu!' });
    } catch (err) {
        next(err);
    }
};

exports.saveRecipeBOM = async (req, res, next) => {
    const { product_id, ingredient_id, quantity_required } = req.body;
    try {
        await db.query(
            `INSERT INTO product_recipes (product_id, ingredient_id, quantity_required)
             VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity_required = VALUES(quantity_required)`,
            [product_id, ingredient_id, quantity_required]
        );
        broadcastAdminSync(req, 'BOM_SAVED');
        res.json({ message: 'Đã lưu công thức BOM (product_recipes)!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteRecipeBOM = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM product_recipes WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'BOM_DELETED');
        res.json({ message: 'Đã xóa công thức BOM!' });
    } catch (err) {
        next(err);
    }
};

// ============================================================================
// 4. BẢNG USERS (NHÂN SỰ & PHÂN QUYỀN RBAC)
// ============================================================================
exports.getStaff = async (req, res, next) => {
    try {
        const [users] = await db.query(
            `SELECT id, full_name, email, phone, role, membership_tier, loyalty_points, is_active, created_at
             FROM users ORDER BY id DESC`
        );
        res.json(users);
    } catch (err) {
        next(err);
    }
};

exports.createStaff = async (req, res, next) => {
    const { full_name, email, phone, password, role } = req.body;
    try {
        const cleanEmail = email.trim().toLowerCase();
        const [exist] = await db.query(
            `SELECT id FROM users WHERE email = ? OR (phone IS NOT NULL AND phone != '' AND phone = ?)`,
            [cleanEmail, phone?.trim() || null]
        );
        if (exist.length > 0) {
            return res.status(400).json({ message: 'Email hoặc Số điện thoại này đã tồn tại trên hệ thống!' });
        }
        const hash = await bcrypt.hash(password, 10);
        const [resStaff] = await db.query(
            `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
            [full_name.trim(), cleanEmail, phone?.trim() || null, hash, role || 'cashier']
        );
        broadcastAdminSync(req, 'USER_CREATED', { userId: resStaff.insertId, role });
        res.status(201).json({
            message: `Đã tạo tài khoản [${cleanEmail}] với quyền [${(role || 'cashier').toUpperCase()}] thành công!`,
            staffId: resStaff.insertId
        });
    } catch (err) {
        next(err);
    }
};

exports.updateStaff = async (req, res, next) => {
    const { id } = req.params;
    const { full_name, phone, password, role, is_active } = req.body;
    try {
        if (password && password.trim() !== '') {
            const hash = await bcrypt.hash(password.trim(), 10);
            await db.query(
                `UPDATE users SET full_name = ?, phone = ?, password_hash = ?, role = ?, is_active = ? WHERE id = ?`,
                [full_name, phone, hash, role, is_active ?? true, id]
            );
        } else {
            await db.query(
                `UPDATE users SET full_name = ?, phone = ?, role = ?, is_active = ? WHERE id = ?`,
                [full_name, phone, role, is_active ?? true, id]
            );
        }
        broadcastAdminSync(req, 'USER_UPDATED', { userId: Number(id), role });
        res.json({ message: 'Đã cập nhật thông tin & phân quyền tài khoản thành công!' });
    } catch (err) {
        next(err);
    }
};

exports.deleteStaff = async (req, res, next) => {
    try {
        if (Number(req.params.id) === Number(req.user.id)) {
            return res.status(400).json({ message: 'Không thể tự xóa tài khoản Admin đang đăng nhập!' });
        }
        await db.query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'USER_DELETED', { userId: Number(req.params.id) });
        res.json({ message: 'Đã xóa tài khoản khỏi Aiven MySQL!' });
    } catch (err) {
        next(err);
    }
};

// ============================================================================
// 5. BẢNG VOUCHERS (CÓ NGÀY BẮT ĐẦU & NGÀY HẾT HẠN) & CRM KHÁCH HÀNG
// ============================================================================
exports.getCrm = async (req, res, next) => {
    try {
        await ensureSchemaColumns();
        const [customers] = await db.query(
            `SELECT id, full_name, email, phone, membership_tier, loyalty_points, created_at
             FROM users WHERE role = 'customer' ORDER BY loyalty_points DESC`
        );
        const [vouchers] = await db.query(`SELECT * FROM vouchers ORDER BY id DESC`);
        res.json({ customers, vouchers });
    } catch (err) {
        next(err);
    }
};

const formatSqlDateTime = (val, fallbackDate) => {
    if (!val) return fallbackDate;
    return String(val).replace('T', ' ').slice(0, 19);
};

exports.createVoucher = async (req, res, next) => {
    const {
        id,
        code,
        discount_type,
        discount_value,
        min_order_value,
        required_tier,
        starts_at,
        expires_at,
        is_active
    } = req.body;

    try {
        await ensureSchemaColumns();
        const cleanCode = (code || '').trim().toUpperCase();
        if (!cleanCode) {
            return res.status(400).json({ message: 'Vui lòng nhập mã Voucher!' });
        }

        const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const startDateStr = formatSqlDateTime(starts_at, nowStr);
        const expireDateStr = formatSqlDateTime(expires_at, '2027-12-31 23:59:59');

        if (new Date(expireDateStr) <= new Date(startDateStr)) {
            return res.status(400).json({ message: 'Ngày hết hạn phải lớn hơn ngày bắt đầu sử dụng!' });
        }

        if (id) {
            await db.query(
                `UPDATE vouchers
                 SET code = ?,
                     discount_type = ?,
                     discount_value = ?,
                     min_order_value = ?,
                     required_tier = ?,
                     starts_at = ?,
                     expires_at = ?,
                     is_active = ?
                 WHERE id = ?`,
                [
                    cleanCode,
                    discount_type || 'percent',
                    Number(discount_value) || 0,
                    Number(min_order_value) || 0,
                    required_tier || 'standard',
                    startDateStr,
                    expireDateStr,
                    is_active !== undefined ? (is_active ? 1 : 0) : 1,
                    id
                ]
            );
            broadcastAdminSync(req, 'VOUCHER_UPDATED');
            return res.json({ message: `Đã cập nhật Voucher [${cleanCode}] thành công!` });
        }

        await db.query(
            `INSERT INTO vouchers (code, discount_type, discount_value, min_order_value, required_tier, starts_at, expires_at, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                discount_type = VALUES(discount_type),
                discount_value = VALUES(discount_value),
                min_order_value = VALUES(min_order_value),
                required_tier = VALUES(required_tier),
                starts_at = VALUES(starts_at),
                expires_at = VALUES(expires_at),
                is_active = VALUES(is_active)`,
            [
                cleanCode,
                discount_type || 'percent',
                Number(discount_value) || 0,
                Number(min_order_value) || 0,
                required_tier || 'standard',
                startDateStr,
                expireDateStr,
                is_active !== undefined ? (is_active ? 1 : 0) : 1
            ]
        );
        broadcastAdminSync(req, 'VOUCHER_CREATED');
        res.status(201).json({ message: `Đã phát hành Voucher [${cleanCode}] thành công!` });
    } catch (err) {
        next(err);
    }
};

exports.deleteVoucher = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM vouchers WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'VOUCHER_DELETED');
        res.json({ message: 'Đã xóa Voucher!' });
    } catch (err) {
        next(err);
    }
};

// ============================================================================
// 6. BẢNG ORDERS, REVIEWS & THỐNG KÊ DOANH THU + XUẤT EXCEL / PDF
// ============================================================================
exports.getAllOrdersAdmin = async (req, res, next) => {
    try {
        const [orders] = await db.query(
            `SELECT o.*, u.full_name AS customer_name, t.table_number
             FROM orders o
             LEFT JOIN users u ON o.customer_id = u.id
             LEFT JOIN cafe_tables t ON o.table_id = t.id
             ORDER BY o.created_at DESC`
        );
        res.json(orders);
    } catch (err) {
        next(err);
    }
};

exports.deleteReviewAdmin = async (req, res, next) => {
    try {
        await db.query(`DELETE FROM reviews WHERE id = ?`, [req.params.id]);
        broadcastAdminSync(req, 'REVIEW_DELETED');
        res.json({ message: 'Đã xóa đánh giá (reviews)!' });
    } catch (err) {
        next(err);
    }
};

exports.getAnalytics = async (req, res, next) => {
    const { period = 'day' } = req.query;
    const fmt = { day: '%Y-%m-%d', week: '%x-W%v', month: '%Y-%m', year: '%Y' }[period] || '%Y-%m-%d';
    try {
        const [revenueChart] = await db.query(
            `SELECT DATE_FORMAT(created_at, ?) AS label,
                    COUNT(id) AS total_orders,
                    COALESCE(SUM(final_amount), 0) AS revenue
             FROM orders
             WHERE payment_status = 'paid'
             GROUP BY label
             ORDER BY label ASC
             LIMIT 30`,
            [fmt]
        );
        const [bestSellers] = await db.query(
            `SELECT p.id, p.name, p.description, p.item_type, p.sold_count, p.base_price, p.image_url, c.name AS category_name, c.category_type
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             ORDER BY p.sold_count DESC
             LIMIT 5`
        );
        const [lowestRevenue] = await db.query(
            `SELECT p.id, p.name, p.description, p.item_type, p.sold_count, p.base_price, c.name AS category_name, c.category_type,
                    COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_rev
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN order_items oi ON p.id = oi.product_id
             GROUP BY p.id
             ORDER BY total_rev ASC
             LIMIT 5`
        );
        res.json({ revenueChart, bestSellers, lowestRevenue });
    } catch (err) {
        next(err);
    }
};

exports.exportExcel = async (req, res, next) => {
    try {
        const [orders] = await db.query(
            `SELECT id, order_type, total_amount, discount_amount, final_amount, payment_method, created_at
             FROM orders WHERE payment_status = 'paid' ORDER BY created_at DESC`
        );
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Bao_Cao_Doanh_Thu');
        ws.columns = [
            { header: 'Mã Đơn', key: 'id', width: 12 },
            { header: 'Loại Đơn', key: 'order_type', width: 15 },
            { header: 'Tạm Tính', key: 'total_amount', width: 16 },
            { header: 'Giảm Giá', key: 'discount_amount', width: 15 },
            { header: 'Thực Thu (VNĐ)', key: 'final_amount', width: 18 },
            { header: 'Thanh Toán', key: 'payment_method', width: 15 },
            { header: 'Ngày Tạo', key: 'created_at', width: 22 }
        ];
        orders.forEach((o) => ws.addRow(o));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Bao_Cao_Doanh_Thu_Cafe.xlsx');
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
};

exports.exportPDF = async (req, res, next) => {
    try {
        const [orders] = await db.query(
            `SELECT id, order_type, final_amount, payment_method, created_at
             FROM orders WHERE payment_status = 'paid' ORDER BY created_at DESC LIMIT 50`
        );
        const doc = new PDFDocument({ margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Bao_Cao_Doanh_Thu_Cafe.pdf');
        doc.pipe(res);
        doc.fontSize(18).text('BAO CAO DOANH THU CAFE SYSTEM', { align: 'center' });
        doc.moveDown();
        let total = 0;
        orders.forEach((o) => {
            total += Number(o.final_amount);
            doc
                .fontSize(11)
                .text(
                    `Don #${o.id} | ${(o.order_type || '').toUpperCase()} | TT: ${(o.payment_method || 'cash').toUpperCase()} | ${Number(o.final_amount).toLocaleString()} VND`
                );
        });
        doc.moveDown();
        doc.fontSize(14).text(`TONG DOANH THU THUC THU: ${total.toLocaleString()} VND`, { align: 'right' });
        doc.end();
    } catch (err) {
        next(err);
    }
};