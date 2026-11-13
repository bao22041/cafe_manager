import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PosLayout() {
    const { user, logout } = useAuth();
    return (
        <div style={{ background: '#f1f5f9', minHeight: '100vh' }}>
            <header className="app-header" style={{ background: '#1e293b', color: '#fff', borderBottom: 'none' }}>
                <div className="brand-logo" style={{ color: '#fff' }}>
                    <span>🖥️</span>
                    <div>
                        <div>POS TERMINAL — QUẢN LÝ BÀN & THU NGÂN</div>
                        <small style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Đồng bộ Real-time với Quầy Pha chế KDS</small>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="badge badge-loyal">Ca trực: {user.full_name} ({user.role.toUpperCase()})</span>
                    <button onClick={logout} className="btn-danger btn-sm">Kết thúc ca</button>
                </div>
            </header>
            <main className="page-container">
                <Outlet />
            </main>
        </div>
    );
}