// backend/controllers/orderPosController.js
const db = require('../config/db');

// Hàm kiểm tra sản phẩm là Đồ ăn (không có đường/đá, đơn vị là 'cái')
const isFoodItemByRecord = (prodInfo = {}, itemPayload = {}) => {
    if (itemPayload.item_type === 'drink' || prodInfo.item_type === 'drink') return false;
    if (itemPayload.item_type === 'food' || prodInfo.item_type === 'food') return true;
    if (itemPayload.is_food === false || itemPayload.custom_options?.is_food === false) return false;
    if (itemPayload.is_food === true || itemPayload.custom_options?.is_food === true) return true;

    const cleanName = String(prodInfo.name || itemPayload.name || '').toLowerCase();
    const drinkKeywords = [
        'trà ', 'trà đào', 'trà vải', 'trà dâu', 'trà ổi', 'trà tắc', 'trà chanh', 'trà sen',
        'trà sữa', 'ô long', 'hồng trà', 'lục trà', 'cà phê', 'cafe', 'coffee', 'espresso',
        'latte', 'cappuccino', 'americano', 'bạc xỉu', 'macchiato', 'matcha', 'cacao',
        'sô cô la', 'chocolate', 'sinh tố', 'nước ép', 'đá xay', 'freeze', 'soda', 'yakult'
    ];
    if (drinkKeywords.some((kw) => cleanName.includes(kw))) {
        return false;
    }

    if (prodInfo.category_type === 'food') return true;

    const text = `${cleanName} ${prodInfo.description || ''}`.toLowerCase();
    const foodKeywords = [
        'bánh', '[đồ ăn]', 'đồ ăn', 'thức ăn', 'ăn vặt', 'snack', 'croissant', 'tiramisu',
        'mousse', 'flan', 'cheesecake', 'cookie', 'macaron', 'bò khô', 'khô gà',
        'hướng dương', 'khoai tây', 'xúc xích', 'sandwich', 'burger', 'pizza',
        'mì', 'cơm', 'salad', 'pastry', 'bakery', 'food'
    ];
    return foodKeywords.some((kw) => text.includes(kw));
};

// Phát sự kiện đồng bộ toàn hệ thống (Customer + Barista + POS + Admin)
const broadcastSync = (req, payload = {}) => {
    const io = req.app.get('io');
    if (!io) return;
    io.emit('GLOBAL_SYNC', { timestamp: Date.now(), ...payload });
    io.to('role_cashier').to('role_waiter').emit('TABLE_MAP_UPDATED', payload);
    io.to('role_barista').emit('NEW_ORDER_KDS', payload);
    io.to('role_admin').emit('ADMIN_DATA_UPDATED', payload);
    if (payload.orderId) {
        io.to(`order_${payload.orderId}`).emit('ORDER_STATUS_UPDATED', payload);
    }
    if (payload.customerId) {
        io.to(`user_${payload.customerId}`).emit('ORDER_STATUS_UPDATED', payload);
    }
};

// Hàm kiểm tra hạn sử dụng Voucher (starts_at -> expires_at), đơn tối thiểu & tính tiền giảm theo %
const evaluateVoucherDiscount = async (conn, voucherCode, orderTotal) => {
    if (!voucherCode || !String(voucherCode).trim()) {
        return { discountAmount: 0, appliedCode: null };
    }
    const cleanCode = String(voucherCode).trim().toUpperCase();
    const [vRows] = await conn.query(
        `SELECT * FROM vouchers
         WHERE code = ?
           AND is_active = TRUE
           AND (starts_at IS NULL OR starts_at <= NOW())
           AND expires_at >= NOW()`,
        [cleanCode]
    );

    if (vRows.length === 0) {
        throw new Error(`Mã giảm giá [${cleanCode}] không tồn tại, chưa tới ngày mở hoặc đã hết hạn!`);
    }

    const v = vRows[0];
    const minOrder = Number(v.min_order_value || 0);
    if (Number(orderTotal) < minOrder) {
        throw new Error(
            `Mã [${cleanCode}] chỉ áp dụng cho đơn từ ${minOrder.toLocaleString('vi-VN')}đ trở lên!`
        );
    }

    const discountAmount =
        v.discount_type === 'percent'
            ? Math.round((Number(orderTotal) * Number(v.discount_value || 0)) / 100)
            : Number(v.discount_value || 0);

    return { discountAmount, appliedCode: cleanCode };
};

// 1. Tạo đơn hàng (Hỗ trợ Bàn trống, Bàn đặt trước, Thu ngân/Phục vụ gọi thêm món vào bàn đang ngồi, Mang đi & Đặt Ship)
exports.createOrder = async (req, res, next) => {
    const { customer_id, table_id, target_order_id, order_type, items, voucher_code, delivery_address } = req.body;
    const isStaff = ['cashier', 'waiter', 'admin'].includes(req.user?.role);
    const staff_id = isStaff ? req.user.id : null;
    const finalCustomerId = isStaff ? (customer_id || null) : req.user?.id;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'Danh sách món không được để trống!' });
    }
    if (order_type === 'delivery' && (!delivery_address || !delivery_address.trim())) {
        return res.status(400).json({ message: 'Vui lòng nhập địa chỉ nhận hàng cho đơn Giao hàng (Ship)!' });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        let addedAmount = 0;
        const lowStockAlerts = [];
        const sanitizedItems = [];

        for (const item of items) {
            const qty = Number(item.quantity) || 1;
            const unitPrice = Number(item.unit_price) || 0;
            addedAmount += unitPrice * qty;

            const [[prodInfo]] = await conn.query(
                `SELECT p.name, p.description, p.item_type, c.name AS category_name, c.category_type 
                 FROM products p 
                 LEFT JOIN categories c ON p.category_id = c.id 
                 WHERE p.id = ?`,
                [item.product_id]
            );

            const isFood = isFoodItemByRecord(prodInfo, item);

            const rawOptions = typeof item.custom_options === 'string'
                ? JSON.parse(item.custom_options || '{}')
                : { ...(item.custom_options || {}) };

            if (isFood) {
                delete rawOptions.sugar;
                delete rawOptions.ice;
                delete rawOptions.sugar_level;
                delete rawOptions.ice_level;
                delete rawOptions.size;
                rawOptions.unit = 'cái';
                rawOptions.is_food = true;
            } else {
                rawOptions.unit = 'ly';
                rawOptions.is_food = false;
            }

            sanitizedItems.push({
                ...item,
                quantity: qty,
                unit_price: unitPrice,
                custom_options: rawOptions
            });

            const [recipes] = await conn.query(
                `SELECT r.ingredient_id, r.quantity_required, i.name, i.unit, i.stock_quantity, i.min_threshold
                 FROM product_recipes r
                 JOIN ingredients i ON r.ingredient_id = i.id
                 WHERE r.product_id = ? FOR UPDATE`,
                [item.product_id]
            );

            for (const rec of recipes) {
                const needed = Number(rec.quantity_required) * qty;
                if (Number(rec.stock_quantity) < needed) {
                    throw new Error(`Kho không đủ nguyên liệu [${rec.name}] (Cần ${needed}${rec.unit}, Tồn ${rec.stock_quantity}${rec.unit})`);
                }
                const remaining = Number(rec.stock_quantity) - needed;
                await conn.query(`UPDATE ingredients SET stock_quantity = ? WHERE id = ?`, [remaining, rec.ingredient_id]);

                if (remaining <= Number(rec.min_threshold)) {
                    lowStockAlerts.push({ ingredient: rec.name, remaining, unit: rec.unit });
                }
            }

            await conn.query(`UPDATE products SET sold_count = sold_count + ? WHERE id = ?`, [qty, item.product_id]);
        }

        let orderId = null;
        let finalAmount = 0;
        let totalAmount = addedAmount;
        let discountAmount = 0;
        let appliedVoucherCode = null;

        if (target_order_id) {
            const [[existingByTarget]] = await conn.query(
                `SELECT * FROM orders WHERE id = ? AND payment_status = 'unpaid' AND status != 'cancelled' FOR UPDATE`,
                [target_order_id]
            );
            if (existingByTarget) {
                orderId = existingByTarget.id;
                totalAmount = Number(existingByTarget.total_amount) + addedAmount;
                discountAmount = Number(existingByTarget.discount_amount);
                appliedVoucherCode = existingByTarget.voucher_code;
            }
        }

        if (!orderId && order_type === 'dine_in' && table_id) {
            const [[tableRow]] = await conn.query(`SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE`, [table_id]);
            if (!tableRow) throw new Error('Không tìm thấy bàn đã chọn!');

            if (tableRow.current_order_id) {
                const [[existingOrder]] = await conn.query(
                    `SELECT * FROM orders WHERE id = ? AND payment_status = 'unpaid' AND status != 'cancelled' FOR UPDATE`,
                    [tableRow.current_order_id]
                );
                if (existingOrder) {
                    orderId = existingOrder.id;
                    totalAmount = Number(existingOrder.total_amount) + addedAmount;
                    discountAmount = Number(existingOrder.discount_amount);
                    appliedVoucherCode = existingOrder.voucher_code;
                }
            }
        }

        const codeToApply = voucher_code || appliedVoucherCode;
        if (codeToApply) {
            const voucherRes = await evaluateVoucherDiscount(conn, codeToApply, totalAmount);
            discountAmount = voucherRes.discountAmount;
            appliedVoucherCode = voucherRes.appliedCode;
        }

        finalAmount = Math.max(totalAmount - discountAmount, 0);
        const isAppendingToExisting = Boolean(orderId);

        if (orderId) {
            await conn.query(
                `UPDATE orders
                 SET total_amount = ?,
                     discount_amount = ?,
                     final_amount = ?,
                     voucher_code = ?,
                     status = 'preparing',
                     customer_id = COALESCE(customer_id, ?)
                 WHERE id = ?`,
                [totalAmount, discountAmount, finalAmount, appliedVoucherCode, finalCustomerId, orderId]
            );
        } else {
            const [ordRes] = await conn.query(
                `INSERT INTO orders (customer_id, staff_id, table_id, order_type, status, total_amount, discount_amount, final_amount, voucher_code, delivery_address)
                 VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
                [
                    finalCustomerId,
                    staff_id,
                    order_type === 'dine_in' ? (table_id || null) : null,
                    order_type || 'dine_in',
                    totalAmount,
                    discountAmount,
                    finalAmount,
                    appliedVoucherCode,
                    delivery_address || null
                ]
            );
            orderId = ordRes.insertId;
        }

        for (const item of sanitizedItems) {
            await conn.query(
                `INSERT INTO order_items (order_id, product_id, quantity, unit_price, custom_options, item_status)
                 VALUES (?, ?, ?, ?, ?, 'waiting')`,
                [orderId, item.product_id, item.quantity, item.unit_price, JSON.stringify(item.custom_options || {})]
            );
        }

        if (order_type === 'dine_in' && table_id) {
            await conn.query(
                `UPDATE cafe_tables SET status = 'occupied', current_order_id = ? WHERE id = ?`,
                [orderId, table_id]
            );
        }

        await conn.commit();

        const io = req.app.get('io');
        if (lowStockAlerts.length > 0 && io) {
            io.to('role_admin').emit('LOW_STOCK_ALERT', lowStockAlerts);
        }

        broadcastSync(req, {
            event: isAppendingToExisting ? 'ORDER_ITEMS_ADDED' : 'ORDER_CREATED',
            orderId,
            customerId: finalCustomerId,
            table_id: table_id || null,
            order_type,
            status: isAppendingToExisting ? 'preparing' : 'pending'
        });

        res.status(201).json({
            message: isAppendingToExisting
                ? `Đã đặt thêm món vào đơn #${orderId} thành công!`
                : 'Đặt món thành công!',
            orderId,
            totalAmount,
            discountAmount,
            finalAmount
        });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
};

// 2. Lấy toàn bộ đơn hàng đang hoạt động (Tại bàn + Mang đi + Giao hàng Ship) cho POS & Admin
exports.getActivePosOrders = async (req, res, next) => {
    try {
        const [orders] = await db.query(
            `SELECT o.*, t.table_number, a.name AS area_name, u.full_name AS customer_name, u.phone AS customer_phone
             FROM orders o
             LEFT JOIN cafe_tables t ON o.table_id = t.id
             LEFT JOIN areas a ON t.area_id = a.id
             LEFT JOIN users u ON o.customer_id = u.id
             WHERE o.status != 'cancelled' AND (o.payment_status = 'unpaid' OR o.status IN ('pending', 'preparing', 'ready', 'delivering'))
             ORDER BY o.created_at DESC`
        );

        for (const ord of orders) {
            const [items] = await db.query(
                `SELECT oi.*, p.name AS product_name, p.item_type, c.name AS category_name, c.category_type
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE oi.order_id = ?`,
                [ord.id]
            );
            ord.items = items;
        }

        res.json(orders);
    } catch (err) {
        next(err);
    }
};

// 3. Lấy chi tiết 1 hóa đơn theo ID
exports.getOrderById = async (req, res, next) => {
    try {
        const [[order]] = await db.query(
            `SELECT o.*, t.table_number, u.full_name AS customer_name, u.phone AS customer_phone
             FROM orders o
             LEFT JOIN cafe_tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.customer_id = u.id
             WHERE o.id = ?`,
            [req.params.orderId]
        );
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });
        const [items] = await db.query(
            `SELECT oi.*, p.name AS product_name, p.item_type, c.name AS category_name, c.category_type
             FROM order_items oi
             JOIN products p ON oi.product_id = p.id
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE oi.order_id = ?`,
            [req.params.orderId]
        );
        res.json({ order, items });
    } catch (err) {
        next(err);
    }
};

// 4. Đặt trước bàn (Reserve) hoặc Mở lại bàn trống
exports.updateTableReservationStatus = async (req, res, next) => {
    const { tableId } = req.params;
    const { status } = req.body;
    try {
        const [[table]] = await db.query(`SELECT * FROM cafe_tables WHERE id = ?`, [tableId]);
        if (!table) return res.status(404).json({ message: 'Không tìm thấy bàn!' });
        if (table.status === 'occupied' && table.current_order_id) {
            return res.status(400).json({ message: 'Bàn đang có hóa đơn chưa thanh toán, không thể đổi sang trống!' });
        }

        await db.query(`UPDATE cafe_tables SET status = ?, current_order_id = NULL WHERE id = ?`, [status, tableId]);
        broadcastSync(req, { event: 'TABLE_RESERVATION_CHANGED', tableId: Number(tableId), status });
        res.json({ message: `Đã cập nhật Bàn ${table.table_number} sang trạng thái ${status.toUpperCase()}!` });
    } catch (err) {
        next(err);
    }
};

// 5. Chuyển bàn
exports.transferTable = async (req, res, next) => {
    const { fromTableId, toTableId } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[fromT]] = await conn.query(`SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE`, [fromTableId]);
        const [[toT]] = await conn.query(`SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE`, [toTableId]);

        if (!fromT?.current_order_id) throw new Error('Bàn gốc không có hóa đơn hoạt động!');
        if (toT?.status === 'occupied' && toT?.current_order_id) {
            throw new Error('Bàn đích đang có khách, hãy chọn chức năng Gộp bàn!');
        }

        await conn.query(`UPDATE orders SET table_id = ? WHERE id = ?`, [toTableId, fromT.current_order_id]);
        await conn.query(`UPDATE cafe_tables SET status = 'occupied', current_order_id = ? WHERE id = ?`, [fromT.current_order_id, toTableId]);
        await conn.query(`UPDATE cafe_tables SET status = 'empty', current_order_id = NULL WHERE id = ?`, [fromTableId]);

        await conn.commit();
        broadcastSync(req, { event: 'TABLE_TRANSFERRED', fromTableId, toTableId });
        res.json({ message: `Chuyển bàn ${fromT.table_number} sang ${toT.table_number} thành công!` });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
};

// 6. Gộp 2 bàn đang có hóa đơn
exports.mergeTables = async (req, res, next) => {
    const { sourceTableId, targetTableId } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[srcT]] = await conn.query(`SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE`, [sourceTableId]);
        const [[tgtT]] = await conn.query(`SELECT * FROM cafe_tables WHERE id = ? FOR UPDATE`, [targetTableId]);

        if (!srcT?.current_order_id || !tgtT?.current_order_id) {
            throw new Error('Cả hai bàn phải đang có hóa đơn để gộp!');
        }
        if (Number(sourceTableId) === Number(targetTableId)) {
            throw new Error('Không thể gộp cùng 1 bàn!');
        }

        await conn.query(`UPDATE order_items SET order_id = ? WHERE order_id = ?`, [tgtT.current_order_id, srcT.current_order_id]);
        const [[sumRow]] = await conn.query(
            `SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_items WHERE order_id = ?`,
            [tgtT.current_order_id]
        );
        await conn.query(
            `UPDATE orders SET total_amount = ?, final_amount = GREATEST(? - discount_amount, 0) WHERE id = ?`,
            [sumRow.total, sumRow.total, tgtT.current_order_id]
        );

        await conn.query(`UPDATE orders SET status = 'cancelled' WHERE id = ?`, [srcT.current_order_id]);
        await conn.query(`UPDATE cafe_tables SET status = 'empty', current_order_id = NULL WHERE id = ?`, [sourceTableId]);

        await conn.commit();
        broadcastSync(req, { event: 'TABLE_MERGED', sourceTableId, targetTableId });
        res.json({ message: `Đã gộp bàn ${srcT.table_number} vào bàn ${tgtT.table_number}!` });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
};

// 7. Tách hóa đơn sang bàn khác
exports.splitOrder = async (req, res, next) => {
    const { sourceOrderId, targetTableId, itemIdsToMove } = req.body;
    if (!itemIdsToMove || itemIdsToMove.length === 0 || !targetTableId) {
        return res.status(400).json({ message: 'Vui lòng chọn món cần tách và bàn đích!' });
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [newOrd] = await conn.query(
            `INSERT INTO orders (staff_id, table_id, order_type, status) VALUES (?, ?, 'dine_in', 'preparing')`,
            [req.user.id, targetTableId]
        );
        const newOrderId = newOrd.insertId;

        await conn.query(
            `UPDATE order_items SET order_id = ? WHERE order_id = ? AND id IN (?)`,
            [newOrderId, sourceOrderId, itemIdsToMove]
        );

        for (const ordId of [sourceOrderId, newOrderId]) {
            const [[sumRow]] = await conn.query(
                `SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM order_items WHERE order_id = ?`,
                [ordId]
            );
            await conn.query(`UPDATE orders SET total_amount = ?, final_amount = ? WHERE id = ?`, [sumRow.total, sumRow.total, ordId]);
        }

        await conn.query(`UPDATE cafe_tables SET status = 'occupied', current_order_id = ? WHERE id = ?`, [newOrderId, targetTableId]);

        await conn.commit();
        broadcastSync(req, { event: 'ORDER_SPLIT', sourceOrderId, newOrderId });
        res.json({ message: 'Tách hóa đơn thành công!', newOrderId });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
};

// 8. Thanh toán Hóa đơn
exports.confirmPayment = async (req, res, next) => {
    const { orderId } = req.params;
    const { payment_method, voucher_code } = req.body;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[order]] = await conn.query(`SELECT * FROM orders WHERE id = ? FOR UPDATE`, [orderId]);
        if (!order) throw new Error('Không tìm thấy đơn hàng cần thanh toán!');

        const [[sumRow]] = await conn.query(
            `SELECT COALESCE(SUM(quantity * unit_price), 0) AS itemTotal FROM order_items WHERE order_id = ?`,
            [orderId]
        );
        const totalAmount = Number(sumRow.itemTotal) || Number(order.total_amount);

        let discount = Number(order.discount_amount);
        let appliedVoucher = order.voucher_code;

        if (voucher_code) {
            const voucherRes = await evaluateVoucherDiscount(conn, voucher_code, totalAmount);
            discount = voucherRes.discountAmount;
            appliedVoucher = voucherRes.appliedCode;
        }

        const finalAmount = Math.max(totalAmount - discount, 0);

        await conn.query(
            `UPDATE orders
             SET total_amount = ?,
                 discount_amount = ?,
                 final_amount = ?,
                 voucher_code = ?,
                 payment_method = ?,
                 payment_status = 'paid',
                 status = 'completed'
             WHERE id = ?`,
            [totalAmount, discount, finalAmount, appliedVoucher, payment_method || 'cash', orderId]
        );

        await conn.query(
            `UPDATE cafe_tables SET status = 'empty', current_order_id = NULL WHERE id = ? OR current_order_id = ?`,
            [order.table_id || 0, orderId]
        );

        if (order.customer_id) {
            const points = Math.floor(finalAmount / 10000);
            await conn.query(
                `UPDATE users SET loyalty_points = loyalty_points + ?,
                 membership_tier = CASE
                    WHEN loyalty_points + ? >= 500 THEN 'vip'
                    WHEN loyalty_points + ? >= 150 THEN 'loyal'
                    ELSE 'standard'
                 END WHERE id = ?`,
                [points, points, points, order.customer_id]
            );
        }

        await conn.commit();

        broadcastSync(req, {
            event: 'ORDER_PAID',
            orderId: Number(orderId),
            customerId: order.customer_id,
            status: 'completed',
            payment_status: 'paid',
            finalAmount
        });

        res.json({ message: 'Thanh toán thành công & Đã đồng bộ doanh thu!', finalAmount });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ message: err.message });
    } finally {
        conn.release();
    }
};

// 9. Màn hình Pha chế KDS
exports.getKdsOrders = async (req, res, next) => {
    try {
        const [orders] = await db.query(
            `SELECT o.id AS orderId, o.customer_id, o.table_id, t.table_number, o.order_type, o.status, o.delivery_address, o.created_at,
                    u.full_name AS customer_name, u.phone AS customer_phone
             FROM orders o
             LEFT JOIN cafe_tables t ON o.table_id = t.id
             LEFT JOIN users u ON o.customer_id = u.id
             WHERE o.status IN ('pending', 'preparing', 'ready', 'delivering') AND o.payment_status = 'unpaid'
             ORDER BY o.created_at ASC`
        );
        for (const ord of orders) {
            const [items] = await db.query(
                `SELECT oi.*, p.name AS product_name, p.item_type, c.name AS category_name, c.category_type
                 FROM order_items oi
                 JOIN products p ON oi.product_id = p.id
                 LEFT JOIN categories c ON p.category_id = c.id
                 WHERE oi.order_id = ?`,
                [ord.orderId]
            );
            ord.items = items;
        }
        res.json(orders);
    } catch (err) {
        next(err);
    }
};

exports.updateKdsStatus = async (req, res, next) => {
    const { orderId } = req.params;
    const { status } = req.body;
    try {
        const [[order]] = await db.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng!' });

        await db.query(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
        if (status === 'ready' || status === 'completed') {
            await db.query(`UPDATE order_items SET item_status = 'done' WHERE order_id = ?`, [orderId]);
        }

        const io = req.app.get('io');
        if (io && (status === 'ready' || status === 'delivering')) {
            io.to('role_waiter').to('role_cashier').emit('KDS_ORDER_READY', {
                orderId: Number(orderId),
                order_type: order.order_type,
                table_id: order.table_id,
                status
            });
        }

        broadcastSync(req, {
            event: 'ORDER_STATUS_UPDATED',
            orderId: Number(orderId),
            customerId: order.customer_id,
            status
        });

        res.json({ message: `Đã cập nhật trạng thái đơn #${orderId} sang ${status.toUpperCase()}!` });
    } catch (err) {
        next(err);
    }
};