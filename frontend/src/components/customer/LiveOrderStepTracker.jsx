// frontend/src/components/customer/LiveOrderStepTracker.jsx
import React, { useMemo } from 'react';

export default function LiveOrderStepTracker({ activeOrder, onOpenReview, onDismissOrder }) {
    if (!activeOrder) return null;

    // Đếm số món chưa được đánh giá trong đơn hiện tại
    const unreviewedCount = useMemo(() => {
        const uniqueUnreviewed = new Set();
        (activeOrder.items || []).forEach((it) => {
            if (!it.is_reviewed) {
                uniqueUnreviewed.add(Number(it.product_id));
            }
        });
        return uniqueUnreviewed.size;
    }, [activeOrder.items]);

    const isDelivery = activeOrder.order_type === 'delivery';
    const steps = isDelivery
        ? [
              { key: 'pending', title: '1. Chờ duyệt đơn', desc: 'Quán đã nhận đơn Ship' },
              { key: 'preparing', title: '2. Đang pha chế', desc: 'Barista đang chuẩn bị' },
              { key: 'delivering', title: '3. Đang giao Ship', desc: 'Shipper đang giao tới bạn' },
              { key: 'completed', title: '4. Đã giao & Hoàn tất', desc: 'Đã thanh toán thành công' }
          ]
        : [
              { key: 'pending', title: '1. Đang chờ duyệt', desc: 'Đơn đã gửi tới quầy' },
              { key: 'preparing', title: '2. Đang pha chế', desc: 'Barista đang thực hiện' },
              { key: 'ready', title: '3. Pha xong / Hoàn tất', desc: 'Mời bạn thưởng thức' }
          ];

    const isDone = ['ready', 'delivering', 'completed'].includes(activeOrder.status);

    return (
        <div className="tracker-banner">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <span className="badge badge-success">ĐỒNG BỘ TRỰC TIẾP (LIVE SYNC)</span>
                    <h3 style={{ marginTop: 6 }}>
                        Đơn #{activeOrder.orderId || activeOrder.id} —{' '}
                        {activeOrder.order_type === 'dine_in'
                            ? `🍽️ Tại Bàn ${activeOrder.table_number || activeOrder.table_id}`
                            : activeOrder.order_type === 'delivery'
                            ? `🛵 Giao Ship (${activeOrder.delivery_address})`
                            : '🛍️ Mang đi (Take-away)'}
                    </h3>
                    <small>
                        Thanh toán: <b>{activeOrder.payment_status === 'paid' ? '✅ ĐÃ THANH TOÁN' : '⏳ Chưa thanh toán'}</b> • Tổng tiền: <b>{Number(activeOrder.final_amount || 0).toLocaleString()}đ</b>
                    </small>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isDone && unreviewedCount > 0 && (
                        <button type="button" className="btn-warning" onClick={onOpenReview}>
                            ⭐ Đánh giá đồ uống ({unreviewedCount} món)
                        </button>
                    )}
                    {isDone && (
                        <button
                            type="button"
                            className="btn-outline btn-sm"
                            onClick={() => onDismissOrder(activeOrder.orderId || activeOrder.id)}
                        >
                            ✕ Ẩn thanh theo dõi
                        </button>
                    )}
                </div>
            </div>

            <div className="stepper-grid" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
                {steps.map((st) => {
                    const active =
                        activeOrder.status === st.key ||
                        (!isDelivery && st.key === 'ready' && activeOrder.status === 'completed') ||
                        (isDelivery && st.key === 'delivering' && activeOrder.status === 'ready');
                    return (
                        <div key={st.key} className={`step-card ${active ? 'active' : ''}`}>
                            <span style={{ fontSize: 20 }}>{active ? '⏳' : '✓'}</span>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{st.title}</div>
                                <div style={{ fontSize: 11 }}>{st.desc}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}