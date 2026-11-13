// frontend/src/components/admin/CrmVoucherManager.jsx
import React, { useState } from 'react';

const getTodayInputStr = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

const getNextMonthInputStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

export default function CrmVoucherManager({ crmData, onCreateVoucher, onDeleteVoucher }) {
    const [vForm, setVForm] = useState({
        id: '',
        code: '',
        discount_type: 'percent',
        discount_value: 15,
        min_order_value: 50000,
        required_tier: 'standard',
        starts_at: getTodayInputStr(),
        expires_at: getNextMonthInputStr(),
        is_active: true
    });

    // Tính số tiền giảm dự kiến khi áp dụng cho mức đơn tối thiểu
    const estimatedDiscountMoney =
        vForm.discount_type === 'percent'
            ? Math.round((Number(vForm.min_order_value || 0) * Number(vForm.discount_value || 0)) / 100)
            : Number(vForm.discount_value || 0);

    const resetVoucherForm = () => {
        setVForm({
            id: '',
            code: '',
            discount_type: 'percent',
            discount_value: 15,
            min_order_value: 50000,
            required_tier: 'standard',
            starts_at: getTodayInputStr(),
            expires_at: getNextMonthInputStr(),
            is_active: true
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await onCreateVoucher({
                ...vForm,
                starts_at: vForm.starts_at.replace('T', ' ') + ':00',
                expires_at: vForm.expires_at.replace('T', ' ') + ':59'
            });
            resetVoucherForm();
        } catch (err) {
            alert(err.response?.data?.message || 'Lỗi lưu mã giảm giá!');
        }
    };

    const handleEditVoucher = (v) => {
        const toInputFormat = (dt, fallback) => {
            if (!dt) return fallback;
            const d = new Date(dt);
            if (isNaN(d.getTime())) return fallback;
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            return d.toISOString().slice(0, 16);
        };
        setVForm({
            id: v.id,
            code: v.code || '',
            discount_type: v.discount_type || 'percent',
            discount_value: v.discount_value || 10,
            min_order_value: v.min_order_value || 0,
            required_tier: v.required_tier || 'standard',
            starts_at: toInputFormat(v.starts_at, getTodayInputStr()),
            expires_at: toInputFormat(v.expires_at, getNextMonthInputStr()),
            is_active: Boolean(v.is_active)
        });
    };

    const getVoucherStatus = (v) => {
        const now = new Date();
        const start = v.starts_at ? new Date(v.starts_at) : new Date(0);
        const end = new Date(v.expires_at);
        if (!v.is_active) return { label: 'Đã khóa', badge: 'badge-danger' };
        if (now < start) return { label: 'Chưa tới ngày mở', badge: 'badge-warning' };
        if (now > end) return { label: 'Đã hết hạn', badge: 'badge-danger' };
        return { label: 'Đang có hiệu lực', badge: 'badge-success' };
    };

    return (
        <div>
            <div className="card-panel">
                <div className="card-panel-header">
                    <div>
                        <h3>🎟️ Phát hành & Quản lý Mã Giảm giá (CRM Vouchers)</h3>
                        <small>Thiết lập ngày bắt đầu, ngày hết hạn, giá trị đơn tối thiểu và mức % giảm giá tự động tính tiền</small>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    <div>
                        <label>Mã Voucher</label>
                        <input
                            placeholder="VD: CAFE15, HE2026"
                            value={vForm.code}
                            onChange={(e) => setVForm({ ...vForm, code: e.target.value.toUpperCase() })}
                            required
                        />
                    </div>
                    <div>
                        <label>Hình thức giảm giá</label>
                        <select
                            value={vForm.discount_type}
                            onChange={(e) => setVForm({ ...vForm, discount_type: e.target.value })}
                        >
                            <option value="percent">Giảm theo Phần trăm (%) — Tự tính tiền</option>
                            <option value="fixed">Giảm số tiền cố định (VNĐ)</option>
                        </select>
                    </div>
                    <div>
                        <label>{vForm.discount_type === 'percent' ? 'Mức giảm (%)' : 'Số tiền giảm (VNĐ)'}</label>
                        <input
                            type="number"
                            min="1"
                            max={vForm.discount_type === 'percent' ? '100' : '10000000'}
                            value={vForm.discount_value}
                            onChange={(e) => setVForm({ ...vForm, discount_value: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label>Áp dụng cho đơn từ (VNĐ)</label>
                        <input
                            type="number"
                            min="0"
                            step="1000"
                            value={vForm.min_order_value}
                            onChange={(e) => setVForm({ ...vForm, min_order_value: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label>📅 Ngày bắt đầu sử dụng</label>
                        <input
                            type="datetime-local"
                            value={vForm.starts_at}
                            onChange={(e) => setVForm({ ...vForm, starts_at: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label>⏳ Ngày hết hạn sử dụng</label>
                        <input
                            type="datetime-local"
                            value={vForm.expires_at}
                            onChange={(e) => setVForm({ ...vForm, expires_at: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label>Hạng thành viên áp dụng</label>
                        <select
                            value={vForm.required_tier}
                            onChange={(e) => setVForm({ ...vForm, required_tier: e.target.value })}
                        >
                            <option value="standard">Tất cả khách hàng (Standard)</option>
                            <option value="loyal">Khách Thân thiết (Loyal)</option>
                            <option value="vip">Khách VIP</option>
                        </select>
                    </div>

                    {/* Hộp hiển thị tính nhẩm tiền giảm trực tiếp */}
                    <div
                        style={{
                            background: '#fffbeb',
                            border: '1.5px dashed #d97706',
                            borderRadius: 8,
                            padding: '10px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}
                    >
                        <span style={{ fontSize: 12, fontWeight: 700 }}>💡 Quy đổi giảm giá tự động:</span>
                        <span style={{ fontSize: 13 }}>
                            Đơn từ <b>{Number(vForm.min_order_value || 0).toLocaleString('vi-VN')}đ</b> ➔ Giảm{' '}
                            <b>
                                {vForm.discount_type === 'percent' ? `${vForm.discount_value}% ` : ''}
                                (-{estimatedDiscountMoney.toLocaleString('vi-VN')}đ)
                            </b>
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'end', gap: 10 }}>
                        {vForm.id && (
                            <button type="button" className="btn-outline" onClick={resetVoucherForm}>
                                Hủy sửa
                            </button>
                        )}
                        <button type="submit" className="btn-success w-full">
                            {vForm.id ? '💾 Cập nhật Voucher' : '+ Phát hành Mã Voucher'}
                        </button>
                    </div>
                </form>

                <table className="modern-table" style={{ marginTop: 20 }}>
                    <thead>
                        <tr>
                            <th>Mã Voucher</th>
                            <th>Mức giảm (% & Tiền)</th>
                            <th>Đơn tối thiểu</th>
                            <th>Ngày bắt đầu</th>
                            <th>Ngày hết hạn</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(crmData.vouchers || []).map((v) => {
                            const statusInfo = getVoucherStatus(v);
                            const sampleDiscount =
                                v.discount_type === 'percent'
                                    ? Math.round((Number(v.min_order_value || 0) * Number(v.discount_value || 0)) / 100)
                                    : Number(v.discount_value || 0);
                            return (
                                <tr key={v.id}>
                                    <td>
                                        <span className="badge badge-warning" style={{ fontSize: 13 }}>
                                            🏷️ {v.code}
                                        </span>
                                    </td>
                                    <td>
                                        <b>
                                            {v.discount_type === 'percent'
                                                ? `Giảm ${Number(v.discount_value)}% (từ -${sampleDiscount.toLocaleString('vi-VN')}đ)`
                                                : `Giảm ${Number(v.discount_value).toLocaleString('vi-VN')}đ`}
                                        </b>
                                    </td>
                                    <td>
                                        <b>{Number(v.min_order_value || 0).toLocaleString('vi-VN')}đ</b>
                                    </td>
                                    <td>{v.starts_at ? new Date(v.starts_at).toLocaleString('vi-VN') : 'Ngay lập tức'}</td>
                                    <td>{new Date(v.expires_at).toLocaleString('vi-VN')}</td>
                                    <td>
                                        <span className={`badge ${statusInfo.badge}`}>{statusInfo.label}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button
                                                type="button"
                                                className="btn-outline btn-sm"
                                                onClick={() => handleEditVoucher(v)}
                                            >
                                                Sửa
                                            </button>
                                            {onDeleteVoucher && (
                                                <button
                                                    type="button"
                                                    className="btn-danger btn-sm"
                                                    onClick={() => onDeleteVoucher(v.id)}
                                                >
                                                    Xóa
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="card-panel">
                <div className="card-panel-header">
                    <h3>💎 Danh sách Khách hàng Thành viên & Tích điểm CRM</h3>
                </div>
                <table className="modern-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Họ tên khách hàng</th>
                            <th>Email</th>
                            <th>Số điện thoại</th>
                            <th>Điểm tích lũy</th>
                            <th>Hạng thành viên</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(crmData.customers || []).map((c) => (
                            <tr key={c.id}>
                                <td>#{c.id}</td>
                                <td><b>{c.full_name}</b></td>
                                <td>{c.email}</td>
                                <td>{c.phone}</td>
                                <td style={{ fontWeight: 700 }}>⭐ {c.loyalty_points} điểm</td>
                                <td>
                                    <span
                                        className={`badge ${
                                            c.membership_tier === 'vip'
                                                ? 'badge-vip'
                                                : c.membership_tier === 'loyal'
                                                ? 'badge-loyal'
                                                : 'badge-standard'
                                        }`}
                                    >
                                        {c.membership_tier}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}