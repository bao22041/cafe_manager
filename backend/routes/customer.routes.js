// backend/routes/customer.routes.js
const express = require('express');
const router = express.Router();
const custCtrl = require('../controllers/customerController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.get('/catalog', custCtrl.getCatalog);
router.get('/products/:id', custCtrl.getProductDetail);
router.post('/vouchers/validate', custCtrl.validateVoucher);
router.get('/reviews', custCtrl.getReviews);
router.post('/reviews', verifyToken, authorizeRoles('customer', 'admin'), custCtrl.createReview);

module.exports = router;