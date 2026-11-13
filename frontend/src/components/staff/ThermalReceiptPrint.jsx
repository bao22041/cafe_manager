import React from 'react';

export default function ThermalReceiptPrint({ orderDetails }) {
    if (!orderDetails) return null;

    return (
        <div className="card-panel">
            <div className="receipt-paper">
                <h4 style={{ textAlign: 'center', marginBottom: 4 }}>ROASTERY CAFE</h4>
                <p style={{ textAlign: 'center', fontSize: 12, marginBottom: 10 }}>
                    PHIẾU THANH TOÁN / TẠM TÍNH (80MM)<br />
                    Đơn #{orderDetails.order.id} • Bàn: {orderDetails.order.table_id || 'Take-away'}
                </p>
                <hr style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                {orderDetails.items.map((it) => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '4px 0' }}>
                        <span>{it.quantity}x {it.product_name}</span>
                        <span>{(it.quantity * it.unit_price).toLocaleString()}đ</span>
                    </div>
                ))}
                <hr style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>Giảm giá:</span>
                    <span>-{Number(orderDetails.order.discount_amount).toLocaleString()}đ</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, marginTop: 6 }}>
                    <span>TỔNG CỘNG:</span>
                    <span>{Number(orderDetails.order.final_amount).toLocaleString()} VNĐ</span>
                </div>
            </div>
            <button type="button" className="btn-outline w-full" style={{ marginTop: 12 }} onClick={() => window.print()}>
                🖨️ In Hóa đơn Nhiệt (80mm)
            </button>
        </div>
    );
}