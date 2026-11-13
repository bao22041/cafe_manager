// backend/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken, authorizeRoles('admin'));

// Bảng categories, products, product_options
router.post('/categories', adminCtrl.saveCategory);
router.delete('/categories/:id', adminCtrl.deleteCategory);
router.post('/products', adminCtrl.saveProduct);
router.delete('/products/:id', adminCtrl.deleteProduct);
router.get('/product-options', adminCtrl.getProductOptions);
router.post('/product-options', adminCtrl.saveProductOption);
router.delete('/product-options/:id', adminCtrl.deleteProductOption);

// Bảng areas, cafe_tables
router.post('/areas', adminCtrl.saveArea);
router.delete('/areas/:id', adminCtrl.deleteArea);
router.post('/tables', adminCtrl.saveTable);
router.delete('/tables/:id', adminCtrl.deleteTable);

// Bảng ingredients, product_recipes
router.get('/inventory', adminCtrl.getInventory);
router.post('/ingredients', adminCtrl.saveIngredient);
router.delete('/ingredients/:id', adminCtrl.deleteIngredient);
router.post('/recipes-bom', adminCtrl.saveRecipeBOM);
router.delete('/recipes-bom/:id', adminCtrl.deleteRecipeBOM);

// Bảng users (Nhân sự RBAC)
router.get('/staff', adminCtrl.getStaff);
router.post('/staff', adminCtrl.createStaff);
router.put('/staff/:id', adminCtrl.updateStaff);
router.delete('/staff/:id', adminCtrl.deleteStaff);

// Bảng vouchers & CRM
router.get('/crm', adminCtrl.getCrm);
router.post('/vouchers', adminCtrl.createVoucher);
router.delete('/vouchers/:id', adminCtrl.deleteVoucher);

// Bảng orders, order_items, reviews & Báo cáo
router.get('/orders', adminCtrl.getAllOrdersAdmin);
router.delete('/reviews/:id', adminCtrl.deleteReviewAdmin);
router.get('/analytics', adminCtrl.getAnalytics);
router.get('/export/excel', adminCtrl.exportExcel);
router.get('/export/pdf', adminCtrl.exportPDF);

module.exports = router;