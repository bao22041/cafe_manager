import React, { useState } from 'react';

export default function FloorTableMap({ tables, selectedTable, onSelectTable }) {
    const [areaFilter, setAreaFilter] = useState('ALL');
    const areas = Array.from(new Set(tables.map((t) => t.area_name)));

    const filteredTables = areaFilter === 'ALL' ? tables : tables.filter((t) => t.area_name === areaFilter);

    return (
        <div className="card-panel">
            <div className="card-panel-header">
                <div>
                    <h3>🗺️ Sơ đồ Bàn Trực quan theo Khu vực</h3>
                    <small style={{ color: '#64748b' }}>Bấm chọn bàn để tạo đơn mới, tách bill hoặc thanh toán</small>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span className="badge badge-success">Trống: {tables.filter((t) => t.status === 'empty').length}</span>
                    <span className="badge badge-danger">Có khách: {tables.filter((t) => t.status === 'occupied').length}</span>
                    <span className="badge badge-warning">Đặt trước: {tables.filter((t) => t.status === 'reserved').length}</span>
                </div>
            </div>

            <div className="category-pills" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    className={`cat-pill ${areaFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setAreaFilter('ALL')}
                >
                    Tất cả khu vực
                </button>
                {areas.map((area) => (
                    <button
                        type="button"
                        key={area}
                        className={`cat-pill ${areaFilter === area ? 'active' : ''}`}
                        onClick={() => setAreaFilter(area)}
                    >
                        📍 {area}
                    </button>
                ))}
            </div>

            <div className="floor-grid">
                {filteredTables.map((t) => (
                    <div
                        key={t.id}
                        onClick={() => onSelectTable(t)}
                        className={`table-tile status-${t.status} ${selectedTable?.id === t.id ? 'selected' : ''}`}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 16 }}>Bàn {t.table_number}</strong>
                            <span style={{ fontSize: 11, fontWeight: 700 }}>#{t.id}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#475569' }}>{t.area_name} • {t.capacity} ghế</div>
                        <div style={{ marginTop: 4 }}>
                            {t.status === 'empty' && <span className="badge badge-success">Đang trống</span>}
                            {t.status === 'occupied' && <span className="badge badge-danger">Đơn #{t.current_order_id}</span>}
                            {t.status === 'reserved' && <span className="badge badge-warning">Đã đặt trước</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}