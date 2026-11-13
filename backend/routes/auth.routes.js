// backend/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.post('/register', authCtrl.register);
router.post('/login', authCtrl.login);
router.post('/google', authCtrl.googleOAuth);
router.get('/profile', verifyToken, authCtrl.getProfileAndHistory);
router.put('/profile', verifyToken, authCtrl.updateProfile);

module.exports = router;