/**
 * api.js — Pure Axios HTTP client.
 *
 * ZERO React imports. Token is read from localStorage directly.
 * 401 handling dispatches a DOM event so AuthContext can react
 * without any import coupling.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value || '');

const getApiOrigin = () => {
    if (!isAbsoluteUrl(API_BASE)) {
        return typeof window !== 'undefined' ? window.location.origin : '';
    }

    try {
        return new URL(API_BASE).origin;
    } catch {
        return '';
    }
};

export const resolveMediaUrl = (value) => {
    if (!value) return value;
    if (isAbsoluteUrl(value) || value.startsWith('blob:') || value.startsWith('data:')) {
        return value;
    }

    const apiOrigin = getApiOrigin();
    if (!apiOrigin) {
        return value;
    }

    return new URL(value, `${apiOrigin}/`).toString();
};

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
    leave: (id, data) => api.delete(`/rooms/${id}/leave`, { data }),
    // Chat Info Sidebar
    setNickname: (id, targetUserId, nickname) =>
        api.put(`/rooms/${id}/nickname`, { targetUserId, nickname }),
    toggleMute: (id) => api.put(`/rooms/${id}/mute`),
    requestJoin: (id, userId) => api.post(`/rooms/${id}/request-join`, { userId }),
    approveMember: (id, userId) => api.put(`/rooms/${id}/approve`, { userId }),
    rejectMember: (id, userId) => api.put(`/rooms/${id}/reject`, { userId }),
    getPending: (id) => api.get(`/rooms/${id}/pending`),
    updateGroupSettings: (id, data) => api.put(`/rooms/${id}/settings`, data),
    // New chat features
    deleteChat: (id) => api.delete(`/rooms/${id}/chat`),
    pinMessage: (id, messageId) => api.put(`/rooms/${id}/pin`, { messageId }),
    unpinMessage: (id, messageId) => api.put(`/rooms/${id}/unpin`, { messageId }),
    forwardMessage: (messageId, targetRoomId) => api.post('/rooms/forward', { messageId, targetRoomId }),
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
    cancelRequest: (id) => api.delete(`/friends/request/${id}`),
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
    banUser: (id) => api.put(`/admin/users/${id}/ban`),
    unbanUser: (id) => api.put(`/admin/users/${id}/unban`),
    lockUser: (id, duration) => api.put(`/admin/users/${id}/lock`, { duration }),
    resetPassword: (id, newPassword) => api.put(`/admin/users/${id}/reset-password`, { newPassword }),
    // Reports
    getReports: (params) => api.get('/admin/reports', { params }),
    resolveReport: (id, data) => api.put(`/admin/reports/${id}/resolve`, data),
    // Bad words
    getBadWords: () => api.get('/admin/bad-words'),
    addBadWord: (data) => api.post('/admin/bad-words', data),
    removeBadWord: (id) => api.delete(`/admin/bad-words/${id}`),
    // System config
    getConfig: () => api.get('/admin/config'),
    updateConfig: (data) => api.put('/admin/config', data),
    // Admin logs
    getLogs: (params) => api.get('/admin/logs', { params }),
};

// ── Note endpoints ─────────────────────────────────────────────
export const noteAPI = {
    getFriendNotes: () => api.get('/notes'),
    create: (data) => api.post('/notes', data),
    delete: (id) => api.delete(`/notes/${id}`),
    reply: (id, content) => api.post(`/notes/${id}/reply`, { content }),
};

export default api;
