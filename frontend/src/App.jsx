import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './routes/ProtectedRoute';

import CustomerLayout from './layouts/CustomerLayout';
import PosLayout from './layouts/PosLayout';
import KdsLayout from './layouts/KdsLayout';
import AdminLayout from './layouts/AdminLayout';

import AuthPage from './pages/auth/AuthPage';
import CustomerPortal from './pages/customer/CustomerPortal';
import PosWorkspace from './pages/staff/PosWorkspace';
import BaristaKdsBoard from './pages/staff/BaristaKdsBoard';
import AdminDashboard from './pages/admin/AdminDashboard';

export default function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<AuthPage />} />

                        {/* 1. Phân hệ Khách hàng */}
                        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
                            <Route element={<CustomerLayout />}>
                                <Route path="/customer/menu" element={<CustomerPortal />} />
                            </Route>
                        </Route>

                        {/* 2A. Phân hệ Nhân viên Thu ngân & Phục vụ */}
                        <Route element={<ProtectedRoute allowedRoles={['cashier', 'waiter']} />}>
                            <Route element={<PosLayout />}>
                                <Route path="/pos/workspace" element={<PosWorkspace />} />
                            </Route>
                        </Route>

                        {/* 2B. Phân hệ Pha chế KDS */}
                        <Route element={<ProtectedRoute allowedRoles={['barista']} />}>
                            <Route element={<KdsLayout />}>
                                <Route path="/kds/live-board" element={<BaristaKdsBoard />} />
                            </Route>
                        </Route>

                        {/* 3. Phân hệ Quản trị viên */}
                        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                            <Route element={<AdminLayout />}>
                                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                            </Route>
                        </Route>

                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </BrowserRouter>
            </SocketProvider>
        </AuthProvider>
    );
}