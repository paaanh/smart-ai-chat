import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { AuthContext } from '.';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Verify token on mount
    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const { data } = await authAPI.getMe();
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
            } catch {
                logout();
            } finally {
                setLoading(false);
            }
        };
        verify();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = useCallback(async (credentials) => {
        const { data } = await authAPI.login(credentials);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }, []);

    const register = useCallback(async (userData) => {
        const { data } = await authAPI.register(userData);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }, []);

    const loginWithGoogle = useCallback(async (googleData) => {
        const { data } = await authAPI.googleLogin(googleData);
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }, []);

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('preferredLanguage');
    }, []);

    // Listen for forced logout from API 401 interceptor
    useEffect(() => {
        const handleForceLogout = () => logout();
        window.addEventListener('auth:logout', handleForceLogout);
        return () => window.removeEventListener('auth:logout', handleForceLogout);
    }, [logout]);

    const updateUser = useCallback((updated) => {
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, loginWithGoogle, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}
