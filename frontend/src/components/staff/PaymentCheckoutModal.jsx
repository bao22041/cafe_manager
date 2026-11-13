import React, { useState } from 'react';

export default function PaymentCheckoutModal({ orderDetails, onPay }) {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [voucherCode, setVoucherCode] = useState('');

    if (!orderDetails) return null;

    return (
        <div className="card-panel" style={{ borderLeft: '5px solid #059669' }}>
            <div className="card-panel-header">
                <h3>💳 Xác nhận Thanh toán tại Quầy</h3>
                <strong style={{ fontSize: 18, color: '#059669' }}>
                    {Number(orderDetails.order.final_amount).toLocaleString()} VNĐ
                </strong>
            </div>

            <label>Phương thức thanh toán</label>
            <div className="order-type-tabs" style={{ marginBottom: 12 }}>
                {[
                    { id: 'cash', label: '💵 Tiền mặt' },
                    { id: 'qr', label: '📱 Chuyển khoản QR' },
                    { id: 'card', label: '💳 Cà thẻ POS' }
                ].map((m) => (
                    <button
                        type="button"
                        key={m.id}
                        className={`order-type-tab ${paymentMethod === m.id ? 'active' : ''}`}
                        onClick={() => setPaymentMethod(m.id)}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <input
                    placeholder="Áp mã Voucher giảm giá (VD: CAFE10)..."
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                />
                <button
                    type="button"
                    className="btn-success"
                    onClick={() => onPay(orderDetails.order.id, paymentMethod, voucherCode)}
                >
                    ✓ Hoàn tất Thu tiền
                </button>
            </div>
        </div>
    );
}