import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CustomerLayout() {
    const { user, logout } = useAuth();
    const tierClass = user.membership_tier === 'vip' ? 'badge-vip' : user.membership_tier === 'loyal' ? 'badge-loyal' : 'badge-standard';

    return (
        <div>
            <header className="app-header">
                <div className="brand-logo">
                    <span>☕</span>
                    <div>
                        <div>ROASTERY CAFE ONLINE</div>
                        <small style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Đặt món & Theo dõi Pha chế Thời gian thực</small>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="user-pill">
                        <span>👤 <b>{user.full_name}</b></span>
                        <span className={`badge ${tierClass}`}>{user.membership_tier}</span>
                        <span style={{ fontWeight: 700, color: '#7c4d33' }}>⭐ {user.loyalty_points} điểm</span>
                    </div>
                    <button onClick={logout} className="btn-outline btn-sm">Đăng xuất</button>
                </div>
            </header>
            <main className="page-container">
                <Outlet />
            </main>
        </div>
    );
}