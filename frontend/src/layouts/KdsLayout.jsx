import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function KdsLayout() {
    const { user, logout } = useAuth();
    return (
        <div className="kds-dark-wrapper">
            <header className="app-header" style={{ background: '#020617', color: '#fff', borderBottom: '1px solid #1e293b' }}>
                <div className="brand-logo" style={{ color: '#38bdf8' }}>
                    <span>🍹</span>
                    <div>
                        <div>BARISTA KDS — MÀN HÌNH ĐIỀU PHỐI PHA CHẾ</div>
                        <small style={{ fontSize: 11, color: '#94a3b8' }}>Nhận đơn tự động thời gian thực qua Socket.io</small>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="badge badge-success">Barista: {user.full_name}</span>
                    <button onClick={logout} className="btn-danger btn-sm">Đăng xuất</button>
                </div>
            </header>
            <main className="page-container">
                <Outlet />
            </main>
        </div>
    );
}