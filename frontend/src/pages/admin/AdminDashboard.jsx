// frontend/src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import MenuCategoryManager from '../../components/admin/MenuCategoryManager';
import AreaTableManager from '../../components/admin/AreaTableManager';
import InventoryBomManager from '../../components/admin/InventoryBomManager';
import StaffRbacManager from '../../components/admin/StaffRbacManager';
import CrmVoucherManager from '../../components/admin/CrmVoucherManager';
import RevenueAnalyticsView from '../../components/admin/RevenueAnalyticsView';

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const socket = useSocket();
    const [activeSection, setActiveSection] = useState('analytics');
    const [period, setPeriod] = useState('day');
    const [lowStockAlerts, setLowStockAlerts] = useState([]);

    const [catalog, setCatalog] = useState({ categories: [], products: [], tables: [], areas: [], vouchers: [] });
    const [inventory, setInventory] = useState({ ingredients: [], recipes: [] });
    const [staffList, setStaffList] = useState([]);
    const [crmData, setCrmData] = useState({ customers: [], vouchers: [] });
    const [analytics, setAnalytics] = useState({ revenueChart: [], bestSellers: [], lowestRevenue: [] });
    const [liveOrders, setLiveOrders] = useState([]);

    const loadAdminData = useCallback(async () => {
        try {
            const [catRes, invRes, stfRes, crmRes, anaRes, ordRes] = await Promise.all([
                axiosClient.get('/customer/catalog?include_all=true'),
                axiosClient.get('/admin/inventory'),
                axiosClient.get('/admin/staff'),
                axiosClient.get('/admin/crm'),
                axiosClient.get(`/admin/analytics?period=${period}`),
                axiosClient.get('/admin/orders')
            ]);
            setCatalog(catRes.data || { categories: [], products: [], tables: [], areas: [], vouchers: [] });
            setInventory(invRes.data || { ingredients: [], recipes: [] });
            setStaffList(stfRes.data || []);
            setCrmData(crmRes.data || { customers: [], vouchers: [] });
            setAnalytics(anaRes.data || { revenueChart: [], bestSellers: [], lowestRevenue: [] });
            setLiveOrders(ordRes.data || []);
        } catch (err) {
            console.error('Lỗi tải dữ liệu Admin:', err);
        }
    }, [period]);

    useEffect(() => {
        loadAdminData();
    }, [loadAdminData]);

    useEffect(() => {
        if (!socket) return;
        const handleRealtimeSync = () => loadAdminData();
        socket.on('GLOBAL_SYNC', handleRealtimeSync);
        socket.on('ADMIN_DATA_UPDATED', handleRealtimeSync);
        socket.on('LOW_STOCK_ALERT', (alerts) => setLowStockAlerts(alerts));
        return () => {
            socket.off('GLOBAL_SYNC', handleRealtimeSync);
            socket.off('ADMIN_DATA_UPDATED', handleRealtimeSync);
            socket.off('LOW_STOCK_ALERT');
        };
    }, [socket, loadAdminData]);

    const handleExport = async (type) => {
        const res = await axiosClient.get(`/admin/export/${type}`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bao_Cao_Doanh_Thu.${type === 'excel' ? 'xlsx' : 'pdf'}`;
        a.click();
    };

    const totalRev = (analytics.revenueChart || []).reduce((sum, r) => sum + Number(r.revenue || 0), 0);

    return (
        <div className="admin-shell">
            <aside className="admin-sidebar">
                <div>
                    <div className="brand-logo" style={{ padding: '0 8px' }}>
                        <span>⚙️</span> ADMIN PORTAL
                    </div>
                    <div className="admin-nav-list">
                        {[
                            { id: 'analytics', label: '📊 1. Thống kê & Đơn Live' },
                            { id: 'menu', label: '☕ 2. Quản lý Menu & Món' },
                            { id: 'tables', label: '🪑 3. Sơ đồ Bàn & Khu vực' },
                            { id: 'inventory', label: '📦 4. Kho & Định lượng BOM' },
                            { id: 'staff', label: '🛡️ 5. Tài khoản & Phân quyền' },
                            { id: 'crm', label: '💎 6. Khách hàng & Voucher' }
                        ].map((nav) => (
                            <button
                                type="button"
                                key={nav.id}
                                className={`admin-nav-btn ${activeSection === nav.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(nav.id)}
                            >
                                {nav.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: 16 }}>
                    <div style={{ fontSize: 13, marginBottom: 10 }}>
                        Quản trị: <b>{user?.email}</b>
                    </div>
                    <button type="button" className="btn-danger w-full" onClick={logout}>
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <div style={{ padding: '28px 36px' }}>
                {lowStockAlerts.length > 0 && (
                    <div className="error-alert">
                        <strong>⚠️ CẢNH BÁO NGUYÊN LIỆU SẮP HẾT TỒN KHO: </strong>
                        {lowStockAlerts.map((a, i) => (
                            <span key={i}>{`[${a.ingredient}: còn ${a.remaining}${a.unit}] `}</span>
                        ))}
                    </div>
                )}

                <div className="kpi-grid">
                    <div className="kpi-card">
                        <small style={{ fontWeight: 700 }}>DOANH THU ĐÃ THANH TOÁN</small>
                        <div className="kpi-value">{`${totalRev.toLocaleString('vi-VN')}đ`}</div>
                    </div>
                    <div className="kpi-card">
                        <small style={{ fontWeight: 700 }}>TỔNG MÓN TRÊN MENU</small>
                        <div className="kpi-value">{`${(catalog.products || []).length} Món`}</div>
                    </div>
                    <div className="kpi-card">
                        <small style={{ fontWeight: 700 }}>TỔNG TÀI KHOẢN HỆ THỐNG</small>
                        <div className="kpi-value">{`${staffList.length} Tài khoản`}</div>
                    </div>
                    <div className="kpi-card">
                        <small style={{ fontWeight: 700 }}>VOUCHER & HỘI VIÊN CRM</small>
                        <div className="kpi-value">{`${(crmData.vouchers || []).length} Mã`}</div>
                    </div>
                </div>

                {activeSection === 'analytics' && (
                    <>
                        <RevenueAnalyticsView
                            analytics={analytics}
                            period={period}
                            setPeriod={setPeriod}
                            onExport={handleExport}
                        />

                        <div className="card-panel">
                            <div className="card-panel-header">
                                <h3>📡 Giám sát Tất cả Đơn hàng Đồng bộ Thời gian thực (Tại bàn / Mang đi / Đặt Ship)</h3>
                            </div>
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Mã Đơn</th>
                                        <th>Khách hàng</th>
                                        <th>Hình thức / Bàn / Địa chỉ Ship</th>
                                        <th>Mã Voucher</th>
                                        <th>Trạng thái Pha chế</th>
                                        <th>Thanh toán</th>
                                        <th>Thực thu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {liveOrders.slice(0, 15).map((o) => (
                                        <tr key={o.id}>
                                            <td><b>{`#${o.id}`}</b></td>
                                            <td>{o.customer_name || 'Khách tại quầy'}</td>
                                            <td>
                                                {o.order_type === 'dine_in' && `🍽️ Bàn ${o.table_number || o.table_id}`}
                                                {o.order_type === 'take_away' && '🛍️ Mang đi'}
                                                {o.order_type === 'delivery' && `🛵 Ship: ${o.delivery_address}`}
                                            </td>
                                            <td>
                                                {o.voucher_code ? (
                                                    <span className="badge badge-warning">{`🏷️ ${o.voucher_code} (-${Number(o.discount_amount || 0).toLocaleString('vi-VN')}đ)`}</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td>
                                                <span className="badge badge-loyal">{(o.status || '').toUpperCase()}</span>
                                            </td>
                                            <td>
                                                <span className={`badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                    {o.payment_status === 'paid' ? 'Đã thu tiền' : 'Chưa thu'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 700 }}>{`${Number(o.final_amount || 0).toLocaleString('vi-VN')}đ`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeSection === 'menu' && (
                    <MenuCategoryManager
                        categories={catalog.categories}
                        products={catalog.products}
                        onSaveCategory={async (d) => {
                            await axiosClient.post('/admin/categories', d);
                            await loadAdminData();
                        }}
                        onSaveProduct={async (d) => {
                            await axiosClient.post('/admin/products', d);
                            await loadAdminData();
                        }}
                        onDeleteProduct={async (id) => {
                            await axiosClient.delete(`/admin/products/${id}`);
                            await loadAdminData();
                        }}
                    />
                )}

                {activeSection === 'tables' && (
                    <AreaTableManager
                        areas={catalog.areas}
                        tables={catalog.tables}
                        onSaveArea={async (d) => {
                            await axiosClient.post('/admin/areas', d);
                            await loadAdminData();
                        }}
                        onSaveTable={async (d) => {
                            await axiosClient.post('/admin/tables', d);
                            await loadAdminData();
                        }}
                        onDeleteTable={async (id) => {
                            await axiosClient.delete(`/admin/tables/${id}`);
                            await loadAdminData();
                        }}
                    />
                )}

                {activeSection === 'inventory' && (
                    <InventoryBomManager
                        products={catalog.products}
                        inventory={inventory}
                        onSaveIngredient={async (d) => {
                            await axiosClient.post('/admin/ingredients', d);
                            await loadAdminData();
                        }}
                        onSaveBOM={async (d) => {
                            await axiosClient.post('/admin/recipes-bom', d);
                            await loadAdminData();
                        }}
                    />
                )}

                {activeSection === 'staff' && (
                    <StaffRbacManager
                        staffList={staffList}
                        onCreateStaff={async (d) => {
                            await axiosClient.post('/admin/staff', d);
                            await loadAdminData();
                        }}
                        onUpdateStaff={async (id, d) => {
                            await axiosClient.put(`/admin/staff/${id}`, d);
                            await loadAdminData();
                        }}
                        onDeleteStaff={async (id) => {
                            await axiosClient.delete(`/admin/staff/${id}`);
                            await loadAdminData();
                        }}
                    />
                )}

                {activeSection === 'crm' && (
                    <CrmVoucherManager
                        crmData={crmData}
                        onCreateVoucher={async (d) => {
                            await axiosClient.post('/admin/vouchers', d);
                            await loadAdminData();
                        }}
                        onDeleteVoucher={async (id) => {
                            await axiosClient.delete(`/admin/vouchers/${id}`);
                            await loadAdminData();
                        }}
                    />
                )}
            </div>
        </div>
    );
}