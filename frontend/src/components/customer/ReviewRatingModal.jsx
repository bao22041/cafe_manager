// frontend/src/components/customer/ReviewRatingModal.jsx
import React, { useState, useEffect, useMemo } from 'react';

export default function ReviewRatingModal({ isOpen, items = [], onClose, onSubmitReview }) {
    const [productId, setProductId] = useState('');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Chỉ lấy danh sách các món CHƯA ĐÁNH GIÁ và loại bỏ trùng lặp product_id trong cùng 1 đơn
    const unreviewedItems = useMemo(() => {
        const uniqueMap = new Map();
        items.forEach((it) => {
            if (!it.is_reviewed && !uniqueMap.has(Number(it.product_id))) {
                uniqueMap.set(Number(it.product_id), it);
            }
        });
        return Array.from(uniqueMap.values());
    }, [items]);

    // Tự động gán món đầu tiên chưa đánh giá vào ô Select mỗi khi mở Modal hoặc sau khi xóa 1 món
    useEffect(() => {
        if (unreviewedItems.length > 0) {
            const currentStillExists = unreviewedItems.some(
                (it) => Number(it.product_id) === Number(productId)
            );
            if (!currentStillExists) {
                setProductId(unreviewedItems[0].product_id);
            }
        } else {
            setProductId('');
        }
    }, [unreviewedItems, productId, isOpen]);

    if (!isOpen) return null;

    // Nếu không còn món nào cần đánh giá thì tự động đóng
    if (unreviewedItems.length === 0) {
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        const targetProductId = Number(productId || unreviewedItems[0]?.product_id);
        if (!targetProductId) return;

        setSubmitting(true);
        try {
            await onSubmitReview({
                product_id: targetProductId,
                rating,
                comment: comment.trim()
            });
            setComment('');
            setRating(5);

            // Nếu đây là món cuối cùng trong đơn vừa được đánh giá -> Đóng Modal ngay
            if (unreviewedItems.length <= 1) {
                onClose();
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <form onSubmit={handleSubmit} className="modal-dialog" onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3>⭐ Đánh giá Chất lượng Đồ uống</h3>
                    <span className="badge badge-warning">
                        Còn {unreviewedItems.length} món chưa đánh giá
                    </span>
                </div>

                <label>Chọn món trong đơn hàng ({unreviewedItems.length} món)</label>
                <select
                    value={productId}
                    onChange={(e) => setProductId(Number(e.target.value))}
                    required
                    style={{ marginBottom: 14 }}
                >
                    {unreviewedItems.map((it) => (
                        <option key={it.product_id} value={it.product_id}>
                            ☕ {it.name || it.product_name}
                        </option>
                    ))}
                </select>

                <label>Chấm điểm chất lượng (1 - 5 Sao)</label>
                <div className="option-pill-group">
                    {[5, 4, 3, 2, 1].map((star) => (
                        <button
                            type="button"
                            key={star}
                            className={`option-pill ${rating === star ? 'active' : ''}`}
                            onClick={() => setRating(star)}
                        >
                            {'★'.repeat(star)} ({star})
                        </button>
                    ))}
                </div>

                <label>Nhận xét chi tiết</label>
                <textarea
                    rows={3}
                    placeholder="Hương vị đồ uống và dịch vụ phục vụ như thế nào?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button type="button" className="btn-outline" onClick={onClose} disabled={submitting}>
                        Đóng
                    </button>
                    <button type="submit" className="btn-success" disabled={submitting}>
                        {submitting ? 'Đang lưu...' : '✓ Gửi đánh giá & Xóa khỏi hàng chờ'}
                    </button>
                </div>
            </form>
        </div>
    );
}