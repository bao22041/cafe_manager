// frontend/src/components/admin/RevenueAnalyticsView.jsx
import React from 'react';

export default function RevenueAnalyticsView({ analytics, period, setPeriod, onExport }) {
    const chartList = analytics?.revenueChart || [];
    const maxRev = Math.max(...chartList.map((r) => Number(r.revenue || 0)), 1);

    return (
        <div>
            <div className="card-panel">
                <div className="card-panel-header">
                    <div>
                        <h3>📊 Biểu đồ Doanh thu & Xuất Báo cáo Kế toán</h3>
                        <small style={{ color: '#64748b' }}>Thống kê trực tiếp từ các hóa đơn đã thanh toán trên Aiven MySQL</small>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 150 }}>
                            <option value="day">Theo Ngày</option>
                            <option value="week">Theo Tuần</option>
                            <option value="month">Theo Tháng</option>
                            <option value="year">Theo Năm</option>
                        </select>
                        <button type="button" className="btn-success" onClick={() => onExport('excel')}>
                            <span>📥 Xuất Excel (.xlsx)</span>
                        </button>
                        <button type="button" className="btn-primary" onClick={() => onExport('pdf')}>
                            <span>📄 Xuất PDF (.pdf)</span>
                        </button>
                    </div>
                </div>

                {/* Biểu đồ cột trực quan bằng CSS */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220, padding: '24px 16px', background: '#f8fafc', borderRadius: 12, marginBottom: 20 }}>
                    {chartList.map((r, idx) => {
                        const heightPct = Math.max(Math.round((Number(r.revenue || 0) / maxRev) * 100), 8);
                        return (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                <small style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: '#1e293b' }}>
                                    {`${(Number(r.revenue || 0) / 1000).toFixed(0)}k`}
                                </small>
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: 48,
                                        height: `${heightPct}%`,
                                        background: 'linear-gradient(180deg, #2563eb, #1d4ed8)',
                                        borderRadius: '6px 6px 0 0'
                                    }}
                                />
                                <small style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>{r.label}</small>
                            </div>
                        );
                    })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                        <h4 style={{ marginBottom: 10, color: '#059669' }}>🔥 Top 5 Món Bán chạy nhất</h4>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Tên món</th>
                                    <th>Giá bán</th>
                                    <th>Đã bán</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(analytics?.bestSellers || []).map((p) => {
                                    const isFood = (p.name || '').toLowerCase().includes('bánh') || (p.category_name || '').toLowerCase().includes('bánh');
                                    return (
                                        <tr key={p.id}>
                                            <td><b>{p.name}</b></td>
                                            <td>{`${Number(p.base_price || 0).toLocaleString('vi-VN')}đ`}</td>
                                            <td>
                                                <span className="badge badge-success">
                                                    {`${p.sold_count || 0} ${isFood ? 'cái' : 'ly'}`}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <h4 style={{ marginBottom: 10, color: '#e11d48' }}>📉 Top 5 Món Ít Doanh thu nhất</h4>
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Tên món</th>
                                    <th>Lượt bán</th>
                                    <th>Doanh thu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(analytics?.lowestRevenue || []).map((p) => {
                                    const isFood = (p.name || '').toLowerCase().includes('bánh');
                                    return (
                                        <tr key={p.id}>
                                            <td><b>{p.name}</b></td>
                                            <td>{`${p.sold_count || 0} ${isFood ? 'cái' : 'ly'}`}</td>
                                            <td>{`${Number(p.total_rev || 0).toLocaleString('vi-VN')}đ`}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}