import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const ROLE_HOME_ROUTE = {
    admin: '/admin/dashboard',
    cashier: '/pos/workspace',
    waiter: '/pos/workspace',
    barista: '/kds/live-board',
    customer: '/customer/menu'
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = localStorage.getItem('cafe_user');
        if (savedUser) setUser(JSON.parse(savedUser));
        setLoading(false);
    }, []);

    const saveAuthSession = (token, userData) => {
        localStorage.setItem('cafe_token', token);
        localStorage.setItem('cafe_user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('cafe_token');
        localStorage.removeItem('cafe_user');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, loading, saveAuthSession, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);