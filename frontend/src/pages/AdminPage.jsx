import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminAPI, resolveMediaUrl } from '../services/api';
import {
    Users, Shield, ShieldCheck, MessageSquare, Home, Search,
    Trash2, Edit3, CheckCircle, XCircle, ChevronLeft, ChevronRight,
    Loader2, ArrowLeft, X, BarChart3, UserCheck, Wifi,
    Ban, Lock, Unlock, Key,
    Flag, AlertTriangle, Eye, FileText, Settings,
    Activity, MessageCircle,
    Plus, Minus, ToggleLeft, ToggleRight,
    ClipboardList, Filter,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// ─── Shared Components ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color, sub }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value ?? '—'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                {sub && <p className="text-xs text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

function ConfirmModal({ title, message, onClose, onConfirm, loading, danger = false }) {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                <p className="text-gray-600">{message}</p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={onConfirm} disabled={loading}
                        className={`flex-1 py-2 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Sidebar ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const TABS = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
    { id: 'users', label: 'Quản lý Users', icon: Users },
    { id: 'reports', label: 'Báo cáo vi phạm', icon: Flag },
    { id: 'badwords', label: 'Lọc từ ngữ', icon: AlertTriangle },
    { id: 'config', label: 'Cấu hình hệ thống', icon: Settings },
    { id: 'logs', label: 'Nhật ký Admin', icon: ClipboardList },
];

function Sidebar({ activeTab, setActiveTab, collapsed, setCollapsed }) {
    return (
        <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} shrink-0`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                {!collapsed && <ShieldCheck size={24} className="text-blue-600" />}
                {!collapsed && <span className="font-bold text-gray-800 dark:text-gray-100">Admin Panel</span>}
                <button onClick={() => setCollapsed(!collapsed)} className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === tab.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        title={collapsed ? tab.label : undefined}
                    >
                        <tab.icon size={20} className="shrink-0" />
                        {!collapsed && <span>{tab.label}</span>}
                    </button>
                ))}
            </nav>
        </aside>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Dashboard Tab ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function DashboardTab({ stats }) {
    if (!stats) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Tổng quan hệ thống</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Tổng Users" value={stats.totalUsers} color="bg-blue-500" />
                <StatCard icon={UserCheck} label="Đã xác thực" value={stats.verifiedUsers} color="bg-green-500" />
                <StatCard icon={Wifi} label="Đang online" value={stats.onlineUsers} color="bg-emerald-500" />
                <StatCard icon={Ban} label="Bị ban" value={stats.bannedUsers} color="bg-red-500" />
                <StatCard icon={Home} label="Phòng chat" value={stats.totalRooms} color="bg-purple-500" />
                <StatCard icon={MessageSquare} label="Tin nhắn" value={stats.totalMessages} color="bg-orange-500" />
                <StatCard icon={Flag} label="Tổng báo cáo" value={stats.totalReports} color="bg-yellow-500" />
                <StatCard icon={AlertTriangle} label="Chờ xử lý" value={stats.pendingReports} color="bg-pink-500" />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Users Tab ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function EditUserModal({ user, onClose, onSave }) {
    const [form, setForm] = useState({
        username: user.username || '', email: user.email || '',
        phoneNumber: user.phoneNumber || '', bio: user.bio || '',
        role: user.role || 'user', isVerified: user.isVerified || false,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setSaving(true); setError('');
        try { await onSave(user._id, form); onClose(); }
        catch (err) { setError(err.response?.data?.error || 'Lỗi khi cập nhật'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Chỉnh sửa User</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
                </div>
                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
                <div className="space-y-3">
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                        <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                        <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">Số điện thoại</label>
                        <input type="text" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div><label className="block text-sm font-medium text-gray-600 mb-1">Bio</label>
                        <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={2}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
                    <div className="flex gap-4">
                        <div className="flex-1"><label className="block text-sm font-medium text-gray-600 mb-1">Vai trò</label>
                            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="user">User</option><option value="sub_admin">Sub Admin</option><option value="super_admin">Super Admin</option></select></div>
                        <div className="flex-1"><label className="block text-sm font-medium text-gray-600 mb-1">Xác thực</label>
                            <select value={form.isVerified ? 'true' : 'false'} onChange={e => setForm({ ...form, isVerified: e.target.value === 'true' })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                                <option value="true">Đã xác thực</option><option value="false">Chưa xác thực</option></select></div>
                    </div>
                </div>
                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving && <Loader2 size={16} className="animate-spin" />} Lưu
                    </button>
                </div>
            </div>
        </div>
    );
}

function LockModal({ user, onClose, onLock }) {
    const [duration, setDuration] = useState(60);
    const [loading, setLoading] = useState(false);
    const handleLock = async () => {
        setLoading(true);
        try { await onLock(user._id, duration); onClose(); }
        catch { setLoading(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800">Khóa tạm thời: {user.username}</h3>
                <div><label className="block text-sm font-medium text-gray-600 mb-1">Thời gian (phút)</label>
                    <input type="number" min={1} value={duration} onChange={e => setDuration(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div className="flex gap-2 flex-wrap">
                    {[30, 60, 360, 1440, 10080].map(m => (
                        <button key={m} onClick={() => setDuration(m)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${duration === m ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                            {m < 60 ? `${m}p` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
                        </button>
                    ))}
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={handleLock} disabled={loading}
                        className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading && <Loader2 size={16} className="animate-spin" />} Khóa
                    </button>
                </div>
            </div>
        </div>
    );
}

function ResetPasswordModal({ user, onClose, onReset }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const handleReset = async () => {
        if (password.length < 6) { setError('Mật khẩu ít nhất 6 ký tự'); return; }
        setLoading(true);
        try { await onReset(user._id, password); onClose(); }
        catch (err) { setError(err.response?.data?.error || 'Lỗi'); setLoading(false); }
    };
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800">Reset mật khẩu: {user.username}</h3>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <input type="password" placeholder="Mật khẩu mới (≥6 ký tự)" value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Hủy</button>
                    <button onClick={handleReset} disabled={loading}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading && <Loader2 size={16} className="animate-spin" />} Reset
                    </button>
                </div>
            </div>
        </div>
    );
}

function UsersTab({ currentUser }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [editUser, setEditUser] = useState(null);
    const [deleteUser, setDeleteUser] = useState(null);
    const [lockUser, setLockUser] = useState(null);
    const [resetPwUser, setResetPwUser] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminAPI.getUsers({ page, limit: 20, search, accountStatus: statusFilter });
            setUsers(res.data.users);
            setPagination(res.data.pagination);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, [page, search, statusFilter]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { setPage(1); }, [search, statusFilter]);

    const handleAction = async (action, userId, ...args) => {
        setActionLoading(true);
        try {
            switch (action) {
                case 'update': await adminAPI.updateUser(userId, args[0]); break;
                case 'delete': await adminAPI.deleteUser(userId); break;
                case 'toggleVerified': await adminAPI.toggleVerified(userId); break;
                case 'ban': await adminAPI.banUser(userId); break;
                case 'unban': await adminAPI.unbanUser(userId); break;
                case 'lock': await adminAPI.lockUser(userId, args[0]); break;
                case 'resetPassword': await adminAPI.resetPassword(userId, args[0]); break;

            }
            fetchUsers();
        } catch (err) { console.error(err); }
        finally { setActionLoading(false); }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Users size={22} /> Quản lý Users</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-72">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Tìm theo tên, email, SĐT..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Tất cả</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                        <option value="locked">Locked</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 text-left text-gray-500 dark:text-gray-400">
                                <th className="px-4 py-3 font-medium">User</th>
                                <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                                <th className="px-4 py-3 font-medium">Vai trò</th>
                                <th className="px-4 py-3 font-medium">Trạng thái</th>
                                <th className="px-4 py-3 font-medium">Tài khoản</th>
                                <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-400" /></td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Không tìm thấy user nào</td></tr>
                            ) : users.map(u => (
                                <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                                                {(u.avatar || u.googlePicture) ? <img src={resolveMediaUrl(u.avatar || u.googlePicture)} alt="" className="w-full h-full object-cover" /> : u.username?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{u.username}</p>
                                                <p className="text-xs text-gray-400 sm:hidden truncate">{u.email}</p>
                                            </div>

                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{u.email}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : u.role === 'sub_admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {u.role !== 'user' && <Shield size={12} />} {u.role === 'super_admin' ? 'Super Admin' : u.role === 'sub_admin' ? 'Sub Admin' : 'User'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${u.status === 'online' ? 'bg-green-500' : u.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-300'}`} />
                                        <span className="text-gray-600 dark:text-gray-400 text-xs capitalize">{u.status}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.accountStatus === 'banned' ? 'bg-red-100 text-red-700' : u.accountStatus === 'locked' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                            {u.accountStatus === 'banned' ? 'Banned' : u.accountStatus === 'locked' ? 'Locked' : 'Active'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1 flex-wrap">
                                            <button onClick={() => setEditUser(u)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Chỉnh sửa"><Edit3 size={15} /></button>
                                            <button onClick={() => handleAction('toggleVerified', u._id)} className="p-1.5 hover:bg-gray-50 rounded-lg" title={u.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}>
                                                {u.isVerified ? <CheckCircle size={15} className="text-green-500" /> : <XCircle size={15} className="text-gray-300" />}
                                            </button>
                                            {u._id !== currentUser?._id && (
                                                <>
                                                    {u.accountStatus !== 'banned' ? (
                                                        <button onClick={() => handleAction('ban', u._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Ban"><Ban size={15} /></button>
                                                    ) : (
                                                        <button onClick={() => handleAction('unban', u._id)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Unban"><Unlock size={15} /></button>
                                                    )}
                                                    <button onClick={() => setLockUser(u)} className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-500" title="Khóa tạm"><Lock size={15} /></button>
                                                    <button onClick={() => setResetPwUser(u)} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-500" title="Reset mật khẩu"><Key size={15} /></button>
                                                    <button onClick={() => setDeleteUser(u)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Xóa"><Trash2 size={15} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {pagination && pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                        <span>Trang {pagination.page} / {pagination.totalPages} ({pagination.total} users)</span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
                            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                )}
            </div>

            {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSave={(id, data) => handleAction('update', id, data)} />}
            {deleteUser && <ConfirmModal title="Xác nhận xóa" message={`Bạn có chắc muốn xóa user "${deleteUser.username}"? Không thể hoàn tác.`}
                onClose={() => setDeleteUser(null)} onConfirm={() => { handleAction('delete', deleteUser._id); setDeleteUser(null); }} danger />}
            {lockUser && <LockModal user={lockUser} onClose={() => setLockUser(null)} onLock={(id, dur) => handleAction('lock', id, dur)} />}
            {resetPwUser && <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} onReset={(id, pw) => handleAction('resetPassword', id, pw)} />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Reports Tab ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const REASON_LABELS = {
    spam: 'Spam', harassment: 'Quấy rối', hate_speech: 'Ngôn từ thù ghét',
    violence: 'Bạo lực', inappropriate_content: 'Nội dung không phù hợp',
    impersonation: 'Giả mạo', other: 'Khác',
};

function ReportsTab() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [resolving, setResolving] = useState(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await adminAPI.getReports({ page, limit: 20, status: statusFilter });
            setReports(res.data.reports);
            setPagination(res.data.pagination);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [page, statusFilter]);

    useEffect(() => { fetchReports(); }, [fetchReports]);
    useEffect(() => { setPage(1); }, [statusFilter]);

    const handleResolve = async (id, status, adminNote = '') => {
        setResolving(id);
        try {
            await adminAPI.resolveReport(id, { status, adminNote });
            fetchReports();
        } catch (err) { console.error(err); }
        finally { setResolving(null); }
    };

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-700',
        reviewed: 'bg-blue-100 text-blue-700',
        resolved: 'bg-green-100 text-green-700',
        dismissed: 'bg-gray-100 text-gray-600',
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Flag size={22} /> Báo cáo vi phạm</h2>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Tất cả</option>
                    <option value="pending">Chờ xử lý</option>
                    <option value="resolved">Đã xử lý</option>
                    <option value="dismissed">Đã bỏ qua</option>
                </select>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">Không có báo cáo nào</div>
                ) : reports.map(r => (
                    <div key={r._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><Flag size={16} className="text-red-500" /></div>
                                <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">
                                        <span className="text-gray-500">Từ</span> {r.reporter?.username || '?'} <span className="text-gray-500">→</span> {r.reportedUser?.username || '?'}
                                    </p>
                                    <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString('vi-VN')} · {r.targetType}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || ''}`}>{r.status}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                            <p className="text-sm"><span className="text-gray-500 font-medium">Lý do:</span> {REASON_LABELS[r.reason] || r.reason}</p>
                            {r.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{r.description}</p>}
                            {r.evidence?.length > 0 && (
                                <div className="mt-2 flex gap-2 flex-wrap">{r.evidence.map((e, i) => (
                                    <a key={i} href={resolveMediaUrl(e)} target="_blank" rel="noopener noreferrer"
                                        className="text-xs text-blue-600 underline">Bằng chứng {i + 1}</a>
                                ))}</div>
                            )}
                        </div>
                        {r.reportedUser?.accountStatus && (
                            <p className="text-xs text-gray-400">Trạng thái tài khoản bị báo cáo: <span className="font-medium">{r.reportedUser.accountStatus}</span></p>
                        )}
                        {r.adminNote && <p className="text-xs text-gray-500">Ghi chú admin: {r.adminNote}</p>}
                        {r.status === 'pending' && (
                            <div className="flex gap-2 pt-1">
                                <button onClick={() => handleResolve(r._id, 'resolved')} disabled={resolving === r._id}
                                    className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                                    {resolving === r._id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Xử lý
                                </button>
                                <button onClick={() => handleResolve(r._id, 'dismissed')} disabled={resolving === r._id}
                                    className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50 flex items-center gap-1.5">
                                    <XCircle size={14} /> Bỏ qua
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Trang {pagination.page} / {pagination.totalPages}</span>
                    <div className="flex gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
                        <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Bad Words Tab ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function BadWordsTab() {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newWord, setNewWord] = useState('');
    const [severity, setSeverity] = useState('medium');
    const [adding, setAdding] = useState(false);

    const fetchWords = useCallback(async () => {
        setLoading(true);
        try { const res = await adminAPI.getBadWords(); setWords(res.data); }
        catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchWords(); }, [fetchWords]);

    const handleAdd = async () => {
        if (!newWord.trim()) return;
        setAdding(true);
        try { await adminAPI.addBadWord({ word: newWord.trim(), severity }); setNewWord(''); fetchWords(); }
        catch (err) { alert(err.response?.data?.error || 'Lỗi'); }
        finally { setAdding(false); }
    };

    const handleRemove = async (id) => {
        try { await adminAPI.removeBadWord(id); fetchWords(); }
        catch (err) { console.error(err); }
    };

    const sevColors = { low: 'bg-yellow-100 text-yellow-700', medium: 'bg-orange-100 text-orange-700', high: 'bg-red-100 text-red-700' };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><AlertTriangle size={22} /> Bộ lọc từ ngữ</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
                <div className="flex gap-2">
                    <input type="text" placeholder="Thêm từ cấm..." value={newWord} onChange={e => setNewWord(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                    <select value={severity} onChange={e => setSeverity(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option>
                    </select>
                    <button onClick={handleAdd} disabled={adding || !newWord.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-1.5">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Thêm
                    </button>
                </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                ) : words.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">Chưa có từ nào trong bộ lọc</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {words.map(w => (
                            <div key={w._id} className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="font-mono text-sm text-gray-800 dark:text-gray-200">{w.word}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sevColors[w.severity] || ''}`}>{w.severity}</span>
                                </div>
                                <button onClick={() => handleRemove(w._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Xóa"><Trash2 size={15} /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── System Config Tab ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

function ConfigTab() {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try { const res = await adminAPI.getConfig(); setConfig(res.data); }
            catch (err) { console.error(err); }
            finally { setLoading(false); }
        })();
    }, []);

    const handleToggle = async (key) => {
        const newVal = !config[key];
        setConfig(prev => ({ ...prev, [key]: newVal }));
        setSaving(true);
        try { await adminAPI.updateConfig({ [key]: newVal }); }
        catch (err) { console.error(err); setConfig(prev => ({ ...prev, [key]: !newVal })); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;

    const toggles = [
        { key: 'videoCallEnabled', label: 'Video Call', desc: 'Cho phép người dùng gọi video' },
        { key: 'fileUploadEnabled', label: 'Tải file lên', desc: 'Cho phép upload file và hình ảnh' },
        { key: 'maintenanceMode', label: 'Chế độ bảo trì', desc: 'Tắt truy cập cho người dùng thường' },
    ];

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><Settings size={22} /> Cấu hình hệ thống</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {toggles.map(t => (
                    <div key={t.key} className="flex items-center justify-between px-5 py-4">
                        <div>
                            <p className="font-medium text-gray-800 dark:text-gray-200">{t.label}</p>
                            <p className="text-sm text-gray-500">{t.desc}</p>
                        </div>
                        <button onClick={() => handleToggle(t.key)} disabled={saving}
                            className={`relative w-12 h-7 rounded-full transition-colors ${config[t.key] ? 'bg-blue-600' : 'bg-gray-300'}`}>
                            <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${config[t.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Admin Logs Tab ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const ACTION_LABELS = {
    ban_user: 'Ban user', unban_user: 'Unban user', lock_user: 'Khóa user',
    unlock_user: 'Mở khóa', delete_user: 'Xóa user', reset_password: 'Reset mật khẩu',
    mute_user: 'Mute user', unmute_user: 'Unmute user', update_user: 'Cập nhật user',
    toggle_verified: 'Đổi xác thực', resolve_report: 'Xử lý báo cáo',
    dismiss_report: 'Bỏ qua báo cáo', add_bad_word: 'Thêm từ cấm',
    remove_bad_word: 'Xóa từ cấm', update_config: 'Cập nhật config',
};

function LogsTab() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await adminAPI.getLogs({ page, limit: 50 });
                setLogs(res.data.logs);
                setPagination(res.data.pagination);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        })();
    }, [page]);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><ClipboardList size={22} /> Nhật ký Admin</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">Chưa có log nào</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {logs.map(log => (
                            <div key={log._id} className="px-4 py-3 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Activity size={14} className="text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-gray-800 dark:text-gray-200">
                                        <span className="font-medium">{log.admin?.username || '?'}</span>
                                        {' — '}
                                        <span className="text-gray-600 dark:text-gray-400">{ACTION_LABELS[log.action] || log.action}</span>
                                        {log.targetUser && <span className="text-gray-500"> → {log.targetUser.username}</span>}
                                    </p>
                                    {log.details && <p className="text-xs text-gray-400 mt-0.5">{log.details}</p>}
                                    <p className="text-xs text-gray-400 mt-0.5">{new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {pagination && pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                        <span>Trang {pagination.page} / {pagination.totalPages}</span>
                        <div className="flex gap-1">
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
                            <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// ─── Main Admin Page ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [collapsed, setCollapsed] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        (async () => {
            try { const res = await adminAPI.getStats(); setStats(res.data); }
            catch (err) { console.error(err); }
        })();
    }, []);

    if (currentUser && !['sub_admin', 'super_admin'].includes(currentUser.role)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Shield size={64} className="mx-auto text-red-400" />
                    <h2 className="text-xl font-bold text-gray-800">Không có quyền truy cập</h2>
                    <p className="text-gray-500">Bạn cần quyền Admin để truy cập trang này.</p>
                    <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Về trang chủ</button>
                </div>
            </div>
        );
    }

    const renderTab = () => {
        switch (activeTab) {
            case 'dashboard': return <DashboardTab stats={stats} />;
            case 'users': return <UsersTab currentUser={currentUser} />;
            case 'reports': return <ReportsTab />;
            case 'badwords': return <BadWordsTab />;
            case 'config': return <ConfigTab />;
            case 'logs': return <LogsTab />;
            default: return <DashboardTab stats={stats} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700 sticky top-0 z-40">
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><ArrowLeft size={20} /></button>
                        <ShieldCheck size={24} className="text-blue-600" />
                        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Admin Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Shield size={16} className="text-blue-600" />
                        </div>
                        <span className="hidden sm:inline">{currentUser?.username}</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} setCollapsed={setCollapsed} />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {renderTab()}
                </main>
            </div>
        </div>
    );
}
