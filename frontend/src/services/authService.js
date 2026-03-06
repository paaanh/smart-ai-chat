/**
 * authService.js — Pure logic auth helpers (ZERO React imports).
 *
 * Use this for non-reactive auth checks (route guards at init time,
 * server-side logic, etc.). For reactive UI, use the useAuth() hook.
 */

export const authService = {
    getToken: () => localStorage.getItem('token'),

    getUser: () => {
        try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    setAuth: (token, user) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    clearAuth: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
};

export default authService;
