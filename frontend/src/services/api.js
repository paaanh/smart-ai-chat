/**
 * api.js — Pure Axios HTTP client.
 *
 * ZERO React imports. Token is read from localStorage directly.
 * 401 handling dispatches a DOM event so AuthContext can react
 * without any import coupling.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach JWT from localStorage ──────────────────────
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response: handle 401 via DOM event (no React dependency) ───
api.interceptors.response.use(
    (res) => res,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.dispatchEvent(new Event('auth:logout'));
        }
        return Promise.reject(error);
    }
);

// ── Auth endpoints ─────────────────────────────────────────────
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    googleLogin: (data) => api.post('/auth/google', data),
    getMe: () => api.get('/auth/me'),
    forgotPassword: (data) => api.post('/auth/forgot-password', data),
    verifyOTP: (data) => api.post('/auth/verify-otp', data),
    resetPassword: (data) => api.post('/auth/reset-password', data),
    sendRegisterOTP: (data) => api.post('/auth/send-register-otp', data),
};

// ── User endpoints ─────────────────────────────────────────────
export const userAPI = {
    search: (q) => api.get(`/users/search?q=${encodeURIComponent(q)}`),
    getById: (id) => api.get(`/users/${id}`),
    updateProfile: (data) => {
        // Support FormData (with files) or plain JSON
        if (data instanceof FormData) {
            return api.put('/users/profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            });
        }
        return api.put('/users/profile', data);
    },
    getLanguages: () => api.get('/users/languages'),
};

// ── Room endpoints ─────────────────────────────────────────────
export const roomAPI = {
    create: (data) => api.post('/rooms', data),
    getAll: () => api.get('/rooms'),
    getById: (id) => api.get(`/rooms/${id}`),
    getMessages: (id, page = 1) => api.get(`/rooms/${id}/messages?page=${page}`),
    addMember: (id, userId) => api.post(`/rooms/${id}/members`, { userId }),
    leave: (id) => api.delete(`/rooms/${id}/leave`),
    // Chat Info Sidebar
    setNickname: (id, targetUserId, nickname) =>
        api.put(`/rooms/${id}/nickname`, { targetUserId, nickname }),
    toggleMute: (id) => api.put(`/rooms/${id}/mute`),
    requestJoin: (id, userId) => api.post(`/rooms/${id}/request-join`, { userId }),
    approveMember: (id, userId) => api.put(`/rooms/${id}/approve`, { userId }),
    rejectMember: (id, userId) => api.put(`/rooms/${id}/reject`, { userId }),
    getPending: (id) => api.get(`/rooms/${id}/pending`),
    updateGroupSettings: (id, data) => api.put(`/rooms/${id}/settings`, data),
};

// ── User Actions endpoints (block / report) ───────────────────
export const userActionsAPI = {
    block: (userId) => api.post(`/user-actions/block/${userId}`),
    unblock: (userId) => api.delete(`/user-actions/block/${userId}`),
    getBlocked: () => api.get('/user-actions/blocked'),
    report: (data) => api.post('/user-actions/report', data),
};

// ── Friend endpoints ───────────────────────────────────────────
export const friendAPI = {
    getAll: () => api.get('/friends'),
    getRequests: () => api.get('/friends/requests'),
    getSent: () => api.get('/friends/sent'),
    getStatus: (userId) => api.get(`/friends/status/${encodeURIComponent(userId)}`),
    sendRequest: (recipientId) => api.post('/friends/request', { recipientId }),
    accept: (id) => api.put(`/friends/${id}/accept`),
    reject: (id) => api.put(`/friends/${id}/reject`),
    remove: (id) => api.delete(`/friends/${id}`),
};

// ── Upload endpoints ───────────────────────────────────────────
export const uploadAPI = {
    uploadFile: (formData) =>
        api.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 60000,
        }),
    uploadFiles: (formData) =>
        api.post('/upload/multiple', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        }),
};

// ── Admin endpoints ────────────────────────────────────────────
export const adminAPI = {
    getUsers: (params) => api.get('/admin/users', { params }),
    getStats: () => api.get('/admin/stats'),
    getUserById: (id) => api.get(`/admin/users/${id}`),
    updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),
    toggleVerified: (id) => api.put(`/admin/users/${id}/toggle-verified`),
};

export default api;
