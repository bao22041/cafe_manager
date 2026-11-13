import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, ROLE_HOME_ROUTE } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
    const { user, loading } = useAuth();

    if (loading) return <div>Đang tải phân hệ...</div>;
    if (!user) return <Navigate to="/login" replace />;

    if (!allowedRoles.includes(user.role)) {
        return <Navigate to={ROLE_HOME_ROUTE[user.role]} replace />;
    }

    return <Outlet />;
}