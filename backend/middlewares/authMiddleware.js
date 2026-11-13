// backend/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Không tìm thấy JWT Token xác thực!' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

exports.authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Chặn truy cập RBAC: Quyền [${req.user?.role}] không được phép thực hiện thao tác này!`
            });
        }
        next();
    };
};