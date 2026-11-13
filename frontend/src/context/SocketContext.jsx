import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth();
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        if (!user) {
            if (socket) socket.disconnect();
            return;
        }
        const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
        const newSocket = io(socketUrl, {
            path: '/socket.io/',
            transports: ['websocket', 'polling'],
            auth: { token: localStorage.getItem('cafe_token') }
        });
        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, [user]);

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);