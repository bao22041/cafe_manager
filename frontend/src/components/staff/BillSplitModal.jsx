import React, { useState } from 'react';

export default function BillSplitModal({ orderDetails, tables, onSplit }) {
    const [selectedItems, setSelectedItems] = useState([]);
    const [targetTableId, setTargetTableId] = useState('');

    if (!orderDetails) return null;

    const toggleItem = (id) => {
        if (selectedItems.includes(id)) setSelectedItems(selectedItems.filter((i) => i !== id));
        else setSelectedItems([...selectedItems, id]);
    };

    return (
        <div className="card-panel">
            <div className="card-panel-header">
                <h3>✂️ Tách Hóa đơn (Đơn #{orderDetails.order.id})</h3>
                <span className="badge badge-loyal">Chọn món cần tách</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {orderDetails.items.map((it) => (
                    <label
                        key={it.id}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer'
                        }}
                    >
                        <span>
                            <input
                                type="checkbox"
                                style={{ width: 'auto', marginRight: 8 }}
                                checked={selectedItems.includes(it.id)}
                                onChange={() => toggleItem(it.id)}
                            />
                            <b>{it.quantity}x {it.product_name}</b>
                        </span>
                        <span>{(it.quantity * it.unit_price).toLocaleString()}đ</span>
                    </label>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                <select value={targetTableId} onChange={(e) => setTargetTableId(e.target.value)}>
                    <option value="">-- Chọn bàn trống nhận đơn tách --</option>
                    {tables.filter((t) => t.status === 'empty').map((t) => (
                        <option key={t.id} value={t.id}>Bàn {t.table_number} ({t.area_name})</option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onSplit(orderDetails.order.id, targetTableId, selectedItems)}
                >
                    Tách hóa đơn
                </button>
            </div>
        </div>
    );
}