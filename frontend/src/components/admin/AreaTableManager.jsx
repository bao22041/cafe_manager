import React, { useState } from 'react';

export default function AreaTableManager({ areas, tables, onSaveArea, onSaveTable, onDeleteTable }) {
    const [areaName, setAreaName] = useState('');
    const [tableForm, setTableForm] = useState({ id: '', area_id: areas[0]?.id || 1, table_number: '', capacity: 4, status: 'empty' });

    return (
        <div>
            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>🏢 Thêm Khu vực Không gian Quán</h3>
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); onSaveArea({ name: areaName, description: 'Không gian phục vụ' }); setAreaName(''); }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}
                >
                    <input placeholder="Tên khu vực mới (VD: Sân vườn, Tầng thượng Acoustic)..." value={areaName} onChange={(e) => setAreaName(e.target.value)} required />
                    <button type="submit" className="btn-primary">+ Thêm Khu vực</button>
                </form>
            </div>

            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>🪑 Quản lý Sơ đồ Bàn</h3>
                </div>
                <form
                    onSubmit={(e) => { e.preventDefault(); onSaveTable(tableForm); setTableForm({ id: '', area_id: 1, table_number: '', capacity: 4, status: 'empty' }); }}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 12, alignItems: 'end' }}
                >
                    <div>
                        <label>Khu vực</label>
                        <select value={tableForm.area_id} onChange={(e) => setTableForm({ ...tableForm, area_id: e.target.value })}>
                            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Mã số bàn</label>
                        <input placeholder="VD: T05, SV03" value={tableForm.table_number} onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })} required />
                    </div>
                    <div>
                        <label>Sức chứa (Ghế)</label>
                        <input type="number" value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })} />
                    </div>
                    <div>
                        <label>Trạng thái</label>
                        <select value={tableForm.status} onChange={(e) => setTableForm({ ...tableForm, status: e.target.value })}>
                            <option value="empty">Trống (Empty)</option>
                            <option value="occupied">Có khách (Occupied)</option>
                            <option value="reserved">Đặt trước (Reserved)</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-success">{tableForm.id ? 'Cập nhật Bàn' : '+ Thêm Bàn'}</button>
                </form>

                <table className="modern-table" style={{ marginTop: 20 }}>
                    <thead>
                        <tr><th>ID</th><th>Số bàn</th><th>Khu vực</th><th>Sức chứa</th><th>Trạng thái</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody>
                        {tables.map((t) => (
                            <tr key={t.id}>
                                <td>#{t.id}</td>
                                <td><b>Bàn {t.table_number}</b></td>
                                <td>{t.area_name}</td>
                                <td>{t.capacity} khách</td>
                                <td>
                                    <span className={`badge ${t.status === 'empty' ? 'badge-success' : t.status === 'occupied' ? 'badge-danger' : 'badge-warning'}`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button type="button" className="btn-outline btn-sm" onClick={() => setTableForm(t)}>Sửa</button>
                                        <button type="button" className="btn-danger btn-sm" onClick={() => onDeleteTable(t.id)}>Xóa</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}