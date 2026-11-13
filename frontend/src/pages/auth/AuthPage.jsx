// frontend/src/pages/auth/AuthPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
    const [error, setError] = useState('');
    const { saveAuthSession } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isRegister) {
                await axiosClient.post('/auth/register', form);
                alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
                setIsRegister(false);
            } else {
                const res = await axiosClient.post('/auth/login', {
                    email: form.email.trim(),
                    password: form.password
                });
                saveAuthSession(res.data.token, res.data.user);
                navigate(res.data.targetRoute, { replace: true });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Email hoặc mật khẩu không chính xác');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-showcase">
                <div className="brand-logo" style={{ color: '#fff', fontSize: 22 }}>
                    <span>☕</span> ROASTERY CAFE FULL-STACK
                </div>
                <div>
                    <h1>Hệ thống Quản trị & Vận hành Quán Cà Phê Thời gian thực</h1>
                    <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 520 }}>
                        Đồng bộ thời gian thực giữa Khách hàng, Pha chế (KDS), Thu ngân (POS) và Quản trị viên (Admin). Tự động phân luồng giao diện ngay khi đăng nhập.
                    </p>
                </div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                    © 2026 Cafe Management System • Aiven MySQL Cloud
                </div>
            </div>

            <div className="auth-panel">
                <div className="auth-card">
                    <h2 style={{ fontSize: 26, color: '#231710', marginBottom: 6 }}>
                        {isRegister ? 'Đăng ký Tài khoản Mới' : 'Đăng nhập Hệ thống'}
                    </h2>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 22 }}>
                        {isRegister
                            ? 'Nhập địa chỉ Gmail của bạn để tích điểm thành viên & đặt món'
                            : 'Sử dụng tài khoản Gmail của bạn để truy cập vào hệ thống'}
                    </p>

                    {error && (
                        <div style={{ background: '#fff1f2', color: '#e11d48', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {isRegister && (
                            <>
                                <div>
                                    <label>Họ và tên</label>
                                    <input
                                        placeholder="Nguyễn Văn A"
                                        value={form.full_name}
                                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label>Số điện thoại liên hệ</label>
                                    <input
                                        placeholder="0905xxxxxx"
                                        value={form.phone}
                                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                        required
                                    />
                                </div>
                            </>
                        )}
                        <div>
                            <label>Địa chỉ Email (@gmail.com)</label>
                            <input
                                type="email"
                                placeholder="example@gmail.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label>Mật khẩu</label>
                            <input
                                type="password"
                                placeholder="Nhập mật khẩu..."
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" style={{ padding: 14, fontSize: 15, marginTop: 8 }}>
                            {isRegister ? 'Hoàn tất Đăng ký' : 'Đăng nhập ➔'}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <span
                            onClick={() => setIsRegister(!isRegister)}
                            style={{ fontSize: 14, color: '#7c4d33', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {isRegister ? 'Đã có tài khoản? Quay lại Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}