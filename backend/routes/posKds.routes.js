// backend/routes/posKds.routes.js
const express = require('express');
const router = express.Router();
const posCtrl = require('../controllers/orderPosController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

// Đặt món chung cho Khách & Nhân viên
router.post('/orders', verifyToken, authorizeRoles('customer', 'cashier', 'waiter', 'admin'), posCtrl.createOrder);

// POS Thu ngân, Phục vụ & Admin
router.get('/pos/active-orders', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.getActivePosOrders);
router.get('/pos/orders/:orderId', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.getOrderById);
router.patch('/pos/tables/:tableId/status', verifyToken, authorizeRoles('customer', 'cashier', 'waiter', 'admin'), posCtrl.updateTableReservationStatus);
router.post('/pos/transfer-table', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.transferTable);
router.post('/pos/merge-tables', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.mergeTables);
router.post('/pos/split-order', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.splitOrder);
router.post('/pos/orders/:orderId/pay', verifyToken, authorizeRoles('cashier', 'waiter', 'admin'), posCtrl.confirmPayment);

// KDS Pha chế, Thu ngân & Admin
router.get('/kds/orders', verifyToken, authorizeRoles('barista', 'cashier', 'waiter', 'admin'), posCtrl.getKdsOrders);
router.patch('/kds/orders/:orderId/status', verifyToken, authorizeRoles('barista', 'cashier', 'waiter', 'admin'), posCtrl.updateKdsStatus);

module.exports = router;