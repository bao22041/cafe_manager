import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLayout() {
    const { user, logout } = useAuth();
    return (
        <div className="layout-admin">
            <header className="header-bar admin-bar">
                <h2>⚙️ HỆ THỐNG QUẢN TRỊ VIÊN (ADMIN DASHBOARD)</h2>
                <div>
                    <span>Quản trị viên: <b>{user.full_name}</b> </span>
                    <button onClick={logout}>Đăng xuất</button>
                </div>
            </header>
            <main className="layout-body"><Outlet /></main>
        </div>
    );
}