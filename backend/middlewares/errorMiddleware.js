// backend/middlewares/errorMiddleware.js
module.exports = (err, req, res, next) => {
    console.error('[Aiven API Error]:', err.message);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Lỗi máy chủ nội bộ'
    });
};