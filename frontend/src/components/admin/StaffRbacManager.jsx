// frontend/src/components/admin/StaffRbacManager.jsx
import React, { useState } from 'react';

export default function StaffRbacManager({ staffList, onCreateStaff, onUpdateStaff, onDeleteStaff }) {
    const [form, setForm] = useState({
        id: '',
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'cashier',
        is_active: true
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (form.id) {
                await onUpdateStaff(form.id, form);
                alert('Đã cập nhật tài khoản thành công!');
            } else {
                await onCreateStaff(form);
                alert(`Đã tạo tài khoản ${form.email} (${form.role.toUpperCase()}) và đồng bộ lên Aiven MySQL!`);
            }
            setForm({ id: '', full_name: '', email: '', phone: '', password: '', role: 'cashier', is_active: true });
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi lưu tài khoản');
        }
    };

    return (
        <div className="card-panel">
            <div className="card-panel-header">
                <div>
                    <h3>🛡️ Quản lý Tài khoản & Phân quyền Truy cập (RBAC)</h3>
                </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                <div>
                    <label>Họ và tên</label>
                    <input
                        placeholder="VD: Nguyễn Văn A"
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        required
                    />
                </div>
                <div>
                    <label>Email đăng nhập (@gmail.com)</label>
                    <input
                        type="email"
                        placeholder="VD: cashier@gmail.com"
                        value={form.email}
                        disabled={!!form.id}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                    />
                </div>
                <div>
                    <label>Số điện thoại</label>
                    <input
                        placeholder="VD: 0905123456"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        required
                    />
                </div>
                <div>
                    <label>{form.id ? 'Mật khẩu mới (Để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo'}</label>
                    <input
                        type="password"
                        placeholder="Nhập mật khẩu (VD: 123456)"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required={!form.id}
                    />
                </div>
                <div>
                    <label>Phân quyền Giao diện (Role)</label>
                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        <option value="cashier">🖥️ Thu ngân (POS Cashier)</option>
                        <option value="barista">🍹 Pha chế (Barista KDS)</option>
                        <option value="waiter">🍽️ Phục vụ (POS Waiter)</option>
                        <option value="customer">👤 Khách hàng (Customer Menu)</option>
                        <option value="admin">⚙️ Quản trị viên (Full Admin)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
                    <button type="submit" className="btn-success w-full">
                        {form.id ? '💾 Lưu Cập nhật Quyền' : '+ Tạo Tài khoản & Đồng bộ'}
                    </button>
                    {form.id && (
                        <button
                            type="button"
                            className="btn-outline"
                            onClick={() => setForm({ id: '', full_name: '', email: '', phone: '', password: '', role: 'cashier', is_active: true })}
                        >
                            Hủy
                        </button>
                    )}
                </div>
            </form>

            <table className="modern-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Họ và tên</th>
                        <th>Email</th>
                        <th>Số điện thoại</th>
                        <th>Phân quyền (Role)</th>
                        <th>Giao diện khi đăng nhập</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {staffList.map((st) => (
                        <tr key={st.id}>
                            <td><b>#{st.id}</b></td>
                            <td>{st.full_name}</td>
                            <td><b>{st.email}</b></td>
                            <td>{st.phone || '—'}</td>
                            <td>
                                <span className={`badge ${st.role === 'admin' ? 'badge-vip' : st.role === 'customer' ? 'badge-success' : 'badge-loyal'}`}>
                                    {st.role.toUpperCase()}
                                </span>
                            </td>
                            <td style={{ fontSize: 12, color: '#64748b' }}>
                                {st.role === 'admin' && '/admin/dashboard'}
                                {(st.role === 'cashier' || st.role === 'waiter') && '/pos/workspace'}
                                {st.role === 'barista' && '/kds/live-board'}
                                {st.role === 'customer' && '/customer/menu'}
                            </td>
                            <td>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn-outline btn-sm"
                                        onClick={() => setForm({ ...st, password: '' })}
                                    >
                                        Sửa quyền / MK
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-danger btn-sm"
                                        onClick={async () => {
                                            if (window.confirm(`Xác nhận xóa tài khoản ${st.email}?`)) {
                                                try {
                                                    await onDeleteStaff(st.id);
                                                } catch (err) {
                                                    alert(err.response?.data?.message || 'Không thể xóa tài khoản');
                                                }
                                            }
                                        }}
                                    >
                                        Xóa
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}