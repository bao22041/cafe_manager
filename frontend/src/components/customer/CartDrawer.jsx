// frontend/src/components/customer/CartDrawer.jsx
import React, { useState, useEffect, useMemo } from 'react';

export default function CartDrawer({
    cart,
    setCart,
    tables = [],
    vouchers = [],
    orderMeta,
    setOrderMeta,
    onCheckout,
    onReserveTable
}) {
    const [showVoucherPicker, setShowVoucherPicker] = useState(false);

    const subTotal = useMemo(() => {
        return cart.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
    }, [cart]);

    // Phân tích từng Voucher: Kiểm tra hạn sử dụng & điều kiện tổng tiền đơn hàng
    const evaluatedVouchers = useMemo(() => {
        const now = new Date();
        return (vouchers || []).map((v) => {
            const minOrder = Number(v.min_order_value || 0);
            const startDate = v.starts_at ? new Date(v.starts_at) : new Date(0);
            const expDate = new Date(v.expires_at);

            const isStarted = now >= startDate;
            const isNotExpired = now <= expDate;
            const isEnoughMoney = subTotal > 0 && subTotal >= minOrder;
            const isEligible = Boolean(v.is_active) && isStarted && isNotExpired && isEnoughMoney;

            const discountMoney =
                v.discount_type === 'percent'
                    ? Math.round((subTotal * Number(v.discount_value || 0)) / 100)
                    : Number(v.discount_value || 0);

            const missingMoney = Math.max(minOrder - subTotal, 0);

            return {
                ...v,
                isStarted,
                isNotExpired,
                isEnoughMoney,
                isEligible,
                discountMoney,
                missingMoney
            };
        });
    }, [vouchers, subTotal]);

    // Tìm Voucher đang được chọn hiện tại
    const selectedVoucher = useMemo(() => {
        if (!orderMeta.voucher_code) return null;
        return evaluatedVouchers.find((v) => v.code === orderMeta.voucher_code) || null;
    }, [evaluatedVouchers, orderMeta.voucher_code]);

    // Nếu tổng tiền giỏ hàng giảm xuống dưới mức tối thiểu của Voucher đang chọn -> Tự động gỡ Voucher
    useEffect(() => {
        if (selectedVoucher && !selectedVoucher.isEligible) {
            setOrderMeta((prev) => ({ ...prev, voucher_code: '' }));
        }
    }, [selectedVoucher, setOrderMeta]);

    const discountAmount = selectedVoucher && selectedVoucher.isEligible ? selectedVoucher.discountMoney : 0;
    const finalTotal = Math.max(subTotal - discountAmount, 0);

    const eligibleCount = evaluatedVouchers.filter((v) => v.isEligible).length;

    return (
        <aside className="cart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 18 }}>🛒 Giỏ hàng & Đặt món</h3>
                <span className="badge badge-standard">{cart.length} món</span>
            </div>

            <label>Hình thức nhận món</label>
            <div className="order-type-tabs">
                {[
                    { id: 'dine_in', label: '🍽️ Tại quán' },
                    { id: 'take_away', label: '🛍️ Mang đi' },
                    { id: 'delivery', label: '🛵 Giao Ship' }
                ].map((tab) => (
                    <button
                        type="button"
                        key={tab.id}
                        className={`order-type-tab ${orderMeta.order_type === tab.id ? 'active' : ''}`}
                        onClick={() => setOrderMeta({ ...orderMeta, order_type: tab.id })}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {orderMeta.order_type === 'dine_in' && (
                <div style={{ marginBottom: 12 }}>
                    <label>Chọn Bàn (Bàn trống, Bàn đặt trước hoặc Bàn gọi thêm)</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <select
                            value={orderMeta.table_id}
                            onChange={(e) => setOrderMeta({ ...orderMeta, table_id: e.target.value })}
                        >
                            <option value="">-- Chọn số bàn phục vụ --</option>
                            {tables.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.area_name} - Bàn {t.table_number} (
                                    {t.status === 'empty'
                                        ? 'Trống'
                                        : t.status === 'reserved'
                                        ? 'Đã đặt trước'
                                        : 'Đang ngồi - Gọi thêm'}
                                    )
                                </option>
                            ))}
                        </select>
                        {orderMeta.table_id && (
                            <button
                                type="button"
                                className="btn-warning btn-sm"
                                title="Đặt giữ chỗ trước bàn này"
                                onClick={() => onReserveTable(orderMeta.table_id)}
                            >
                                📌 Đặt trước
                            </button>
                        )}
                    </div>
                </div>
            )}

            {orderMeta.order_type === 'delivery' && (
                <div style={{ marginBottom: 12 }}>
                    <label>Địa chỉ nhận hàng (Đặt Ship)</label>
                    <input
                        placeholder="Nhập số nhà, tên đường, SĐT nhận hàng..."
                        value={orderMeta.delivery_address}
                        onChange={(e) => setOrderMeta({ ...orderMeta, delivery_address: e.target.value })}
                    />
                </div>
            )}

            <div className="cart-items-list">
                {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 10px', fontSize: 13 }}>
                        Giỏ hàng đang trống. Hãy chọn đồ uống hoặc bánh ngọt bên trái!
                    </div>
                ) : (
                    cart.map((it, idx) => {
                        const isFood = Boolean(it.is_food || it.custom_options?.is_food);
                        return (
                            <div key={idx} className="cart-item-card">
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                                        {it.quantity} {isFood ? 'cái' : 'ly'} {it.name}
                                    </div>
                                    {!isFood && it.custom_options && (
                                        <div style={{ fontSize: 12 }}>
                                            Size {it.custom_options.size || 'M'} • {it.custom_options.sugar || '100%'} đường •{' '}
                                            {it.custom_options.ice || '100%'} đá
                                        </div>
                                    )}
                                    <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                                        {(it.unit_price * it.quantity).toLocaleString('vi-VN')}đ
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-outline btn-sm"
                                    onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* KHU VỰC CLICK CHỌN VOUCHER TRỰC QUAN (KHÔNG NHẬP TAY) */}
            <div style={{ marginTop: 12 }}>
                <label>Ưu đãi & Mã giảm giá (Click để chọn)</label>
                <div
                    onClick={() => setShowVoucherPicker(!showVoucherPicker)}
                    style={{
                        border: '2px dashed #d97706',
                        background: selectedVoucher ? '#ecfdf5' : '#fffbeb',
                        padding: '10px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <div>
                        {selectedVoucher ? (
                            <div>
                                <strong>🎟️ Đã chọn: {selectedVoucher.code}</strong>
                                <div style={{ fontSize: 12 }}>
                                    Giảm {selectedVoucher.discount_type === 'percent' ? `${selectedVoucher.discount_value}%` : ''}{' '}
                                    (-{discountAmount.toLocaleString('vi-VN')}đ)
                                </div>
                            </div>
                        ) : (
                            <div>
                                <strong>🎟️ Bấm để chọn Voucher giảm giá</strong>
                                <div style={{ fontSize: 12 }}>
                                    {subTotal === 0
                                        ? 'Hãy thêm món vào giỏ để mở khóa Voucher'
                                        : eligibleCount > 0
                                        ? `Có ${eligibleCount} mã đủ điều kiện áp dụng ngay!`
                                        : 'Chưa đủ giá trị đơn tối thiểu cho các mã hiện có'}
                                </div>
                            </div>
                        )}
                    </div>
                    <span className="badge badge-warning">{showVoucherPicker ? '▲ Thu gọn' : '▼ Chọn mã'}</span>
                </div>

                {/* Danh sách Voucher xổ xuống khi Click */}
                {showVoucherPicker && (
                    <div
                        style={{
                            marginTop: 8,
                            border: '1.5px solid #cbd5e1',
                            borderRadius: 10,
                            padding: 10,
                            background: '#f8fafc',
                            maxHeight: 260,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8
                        }}
                    >
                        {evaluatedVouchers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 12, fontSize: 13 }}>
                                Hiện chưa có mã giảm giá nào đang mở.
                            </div>
                        ) : (
                            evaluatedVouchers.map((v) => {
                                const isSelected = orderMeta.voucher_code === v.code;
                                return (
                                    <div
                                        key={v.id}
                                        onClick={() => {
                                            if (!v.isEligible) return;
                                            setOrderMeta({
                                                ...orderMeta,
                                                voucher_code: isSelected ? '' : v.code
                                            });
                                            setShowVoucherPicker(false);
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            border: isSelected
                                                ? '2px solid #059669'
                                                : v.isEligible
                                                ? '1.5px solid #94a3b8'
                                                : '1px dashed #cbd5e1',
                                            background: isSelected ? '#d1fae5' : v.isEligible ? '#ffffff' : '#f1f5f9',
                                            opacity: v.isEligible ? 1 : 0.6,
                                            cursor: v.isEligible ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: 14 }}>
                                                🏷️ {v.code} —{' '}
                                                {v.discount_type === 'percent'
                                                    ? `Giảm ${Number(v.discount_value)}%`
                                                    : `Giảm ${Number(v.discount_value).toLocaleString('vi-VN')}đ`}
                                            </div>
                                            <div style={{ fontSize: 12 }}>
                                                Đơn tối thiểu: <b>{Number(v.min_order_value).toLocaleString('vi-VN')}đ</b>
                                                {subTotal > 0 && v.isEligible && (
                                                    <span>
                                                        {' '}• Tiết kiệm: <b>-{v.discountMoney.toLocaleString('vi-VN')}đ</b>
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11 }}>
                                                HSD: {v.starts_at ? new Date(v.starts_at).toLocaleDateString('vi-VN') : 'Nay'} ➔{' '}
                                                {new Date(v.expires_at).toLocaleDateString('vi-VN')}
                                            </div>
                                            {!v.isStarted && (
                                                <div style={{ fontSize: 11, fontWeight: 700 }}>
                                                    ⏳ Chưa tới ngày bắt đầu sử dụng
                                                </div>
                                            )}
                                            {!v.isNotExpired && (
                                                <div style={{ fontSize: 11, fontWeight: 700 }}>❌ Mã đã hết hạn</div>
                                            )}
                                            {v.isStarted && v.isNotExpired && !v.isEnoughMoney && (
                                                <div style={{ fontSize: 11, fontWeight: 700 }}>
                                                    🔒 Mua thêm {v.missingMoney.toLocaleString('vi-VN')}đ để mở khóa mã này
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            {v.isEligible ? (
                                                <button
                                                    type="button"
                                                    className={isSelected ? 'btn-danger btn-sm' : 'btn-success btn-sm'}
                                                >
                                                    {isSelected ? 'Bỏ chọn' : 'Chọn'}
                                                </button>
                                            ) : (
                                                <span className="badge badge-standard">Chưa đủ ĐK</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>

            {/* BẢNG TÍNH TIỀN TỰ ĐỘNG RÕ RÀNG */}
            <div style={{ margin: '16px 0', padding: '12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                    <span>Tạm tính:</span>
                    <b>{subTotal.toLocaleString('vi-VN')} VNĐ</b>
                </div>
                {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                        <span>Giảm giá Voucher ({selectedVoucher?.code}):</span>
                        <b>-{discountAmount.toLocaleString('vi-VN')} VNĐ</b>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, paddingTop: 6, borderTop: '1px dashed #cbd5e1' }}>
                    <strong>Thành tiền:</strong>
                    <strong style={{ fontSize: 20 }}>{finalTotal.toLocaleString('vi-VN')} VNĐ</strong>
                </div>
            </div>

            <button type="button" className="btn-success w-full" style={{ padding: 14, fontSize: 15 }} onClick={onCheckout}>
                ⚡ Xác nhận Đặt món ngay
            </button>
        </aside>
    );
}