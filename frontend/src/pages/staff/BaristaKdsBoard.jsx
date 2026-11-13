// frontend/src/pages/staff/BaristaKdsBoard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { useSocket } from '../../context/SocketContext';

export default function BaristaKdsBoard() {
    const socket = useSocket();
    const [orders, setOrders] = useState([]);

    const fetchKds = useCallback(async () => {
        const res = await axiosClient.get('/kds/orders');
        setOrders(res.data);
    }, []);

    useEffect(() => { fetchKds(); }, [fetchKds]);

    useEffect(() => {
        if (!socket) return;
        socket.on('GLOBAL_SYNC', fetchKds);
        socket.on('NEW_ORDER_KDS', fetchKds);
        return () => {
            socket.off('GLOBAL_SYNC', fetchKds);
            socket.off('NEW_ORDER_KDS', fetchKds);
        };
    }, [socket, fetchKds]);

    const updateStatus = async (orderId, status) => {
        await axiosClient.patch(`/kds/orders/${orderId}/status`, { status });
        fetchKds();
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3>🔥 Hàng đợi Pha chế Đồng bộ Thời gian thực ({orders.length} đơn)</h3>
                <button type="button" className="btn-outline" style={{ color: '#fff', borderColor: '#334155' }} onClick={fetchKds}>
                    🔄 Làm mới KDS
                </button>
            </div>

            {orders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, background: '#1e293b', borderRadius: 16, color: '#94a3b8' }}>
                    🎉 Hiện tại tất cả đơn hàng đã được pha chế hoàn tất!
                </div>
            ) : (
                <div className="kds-ticket-grid">
                    {orders.map((o) => (
                        <div key={o.orderId} className={`kds-ticket ${o.status}`}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 14 }}>
                                    <div>
                                        <strong style={{ fontSize: 20, color: '#38bdf8' }}>ĐƠN #{o.orderId}</strong>
                                        <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
                                            {o.order_type === 'dine_in' && `🍽️ Phục vụ tại Bàn ${o.table_number || o.table_id}`}
                                            {o.order_type === 'take_away' && `🛍️ Khách Mang đi (${o.customer_name || 'Khách lẻ'})`}
                                            {o.order_type === 'delivery' && (
                                                <div>
                                                    <span className="badge badge-warning">🛵 ĐƠN ĐẶT SHIP</span>
                                                    <div style={{ fontSize: 12, marginTop: 4 }}>📍 Giao tới: {o.delivery_address}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`badge ${o.status === 'pending' ? 'badge-warning' : o.status === 'preparing' ? 'badge-loyal' : 'badge-success'}`}>
                                        {o.status.toUpperCase()}
                                    </span>
                                </div>

                                <div>
                                    {o.items.map((it, idx) => {
                                        const opts = typeof it.custom_options === 'string'
                                            ? JSON.parse(it.custom_options || '{}')
                                            : (it.custom_options || {});
                                        return (
                                            <div key={idx} className="kds-item-row">
                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#f8fafc' }}>
                                                    {it.quantity}x {it.product_name}
                                                </div>
                                                <div className="kds-option-tags">
                                                    {opts.size && <span className="kds-tag">Size {opts.size}</span>}
                                                    {opts.sugar && <span className="kds-tag">{opts.sugar} Đường</span>}
                                                    {opts.ice && <span className="kds-tag">{opts.ice} Đá</span>}
                                                    {opts.toppings?.map((t, i) => <span key={i} className="kds-tag">+{t}</span>)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {o.status === 'pending' && (
                                    <button type="button" className="btn-primary w-full" onClick={() => updateStatus(o.orderId, 'preparing')}>
                                        ▶️ Nhận đơn — Bắt đầu Pha chế
                                    </button>
                                )}
                                {o.status === 'preparing' && o.order_type !== 'delivery' && (
                                    <button type="button" className="btn-success w-full" onClick={() => updateStatus(o.orderId, 'ready')}>
                                        ✓ Pha xong — Báo Thu ngân / Khách hàng
                                    </button>
                                )}
                                {o.status === 'preparing' && o.order_type === 'delivery' && (
                                    <button type="button" className="btn-warning w-full" onClick={() => updateStatus(o.orderId, 'delivering')}>
                                        🛵 Pha xong — Chuyển sang Đang giao Ship
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}