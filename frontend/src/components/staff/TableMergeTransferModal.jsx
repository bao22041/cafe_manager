import React, { useState } from 'react';

export default function TableMergeTransferModal({ tables, onTransfer, onMerge }) {
    const [sourceTableId, setSourceTableId] = useState('');
    const [targetTableId, setTargetTableId] = useState('');

    return (
        <div className="card-panel">
            <div className="card-panel-header">
                <h3>🔄 Nghiệp vụ Chuyển bàn & Gộp bàn</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                    <label>Từ Bàn (Đang có khách)</label>
                    <select value={sourceTableId} onChange={(e) => setSourceTableId(e.target.value)}>
                        <option value="">-- Chọn bàn nguồn --</option>
                        {tables.filter((t) => t.status === 'occupied').map((t) => (
                            <option key={t.id} value={t.id}>Bàn {t.table_number} (Đơn #{t.current_order_id})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label>Sang Bàn đích</label>
                    <select value={targetTableId} onChange={(e) => setTargetTableId(e.target.value)}>
                        <option value="">-- Chọn bàn đích --</option>
                        {tables.map((t) => (
                            <option key={t.id} value={t.id}>Bàn {t.table_number} ({t.status.toUpperCase()})</option>
                        ))}
                    </select>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-primary w-full" onClick={() => onTransfer(sourceTableId, targetTableId)}>
                    ➡️ Chuyển sang bàn trống
                </button>
                <button type="button" className="btn-warning w-full" onClick={() => onMerge(sourceTableId, targetTableId)}>
                    🔗 Gộp 2 bàn có khách
                </button>
            </div>
        </div>
    );
}