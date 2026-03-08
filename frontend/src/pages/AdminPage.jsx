import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminAPI } from '../services/api';
import {
    Users, Shield, ShieldCheck, MessageSquare, Home, Search,
    Trash2, Edit3, CheckCircle, XCircle, ChevronLeft, ChevronRight,
    Loader2, ArrowLeft, X, BarChart3, UserCheck, Wifi,
} from 'lucide-react';

// ── Stats Card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
            </div>
        </div>
    );
}

// ── Edit User Modal ────────────────────────────────────────────
function EditUserModal({ user, onClose, onSave }) {
    const [form, setForm] = useState({
        username: user.username || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        bio: user.bio || '',
        role: user.role || 'user',
        isVerified: user.isVerified || false,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await onSave(user._id, form);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Lỗi khi cập nhật');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800">Chỉnh sửa User</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg">{error}</p>}

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Số điện thoại</label>
                        <input
                            type="text"
                            value={form.phoneNumber}
                            onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Bio</label>
                        <textarea
                            value={form.bio}
                            onChange={(e) => setForm({ ...form, bio: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Vai trò</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-600 mb-1">Xác thực</label>
                            <select
                                value={form.isVerified ? 'true' : 'false'}
                                onChange={(e) => setForm({ ...form, isVerified: e.target.value === 'true' })}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="true">Đã xác thực</option>
                                <option value="false">Chưa xác thực</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving && <Loader2 size={16} className="animate-spin" />}
                        Lưu
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Delete confirm modal ───────────────────────────────────────
function DeleteModal({ user, onClose, onConfirm }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await onConfirm(user._id);
            onClose();
        } catch (error) {
            console.log(error);
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800">Xác nhận xóa</h3>
                <p className="text-gray-600">
                    Bạn có chắc muốn xóa user <span className="font-semibold">{user.username}</span>?
                    Hành động này không thể hoàn tác.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {deleting && <Loader2 size={16} className="animate-spin" />}
                        Xóa
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Admin Page ────────────────────────────────────────────
export default function AdminPage() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [deleteUser, setDeleteUser] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await adminAPI.getStats();
            setStats(res.data);
        } catch (error) {
            console.log(error);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminAPI.getUsers({ page, limit: 20, search });
            setUsers(res.data.users);
            setPagination(res.data.pagination);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        fetchStats();
        fetchUsers();
    }, [fetchStats, fetchUsers]);

    // Debounce search
    useEffect(() => {
        setPage(1);
    }, [search]);

    const handleUpdateUser = async (id, data) => {
        await adminAPI.updateUser(id, data);
        fetchUsers();
        fetchStats();
    };

    const handleDeleteUser = async (id) => {
        await adminAPI.deleteUser(id);
        fetchUsers();
        fetchStats();
    };

    const handleToggleVerified = async (id) => {
        await adminAPI.toggleVerified(id);
        fetchUsers();
        fetchStats();
    };

    // Redirect if not admin
    if (currentUser && currentUser.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Shield size={64} className="mx-auto text-red-400" />
                    <h2 className="text-xl font-bold text-gray-800">Không có quyền truy cập</h2>
                    <p className="text-gray-500">Bạn cần quyền Admin để truy cập trang này.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Về trang chủ
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <ShieldCheck size={28} className="text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Shield size={16} className="text-blue-600" />
                        </div>
                        <span>{currentUser?.username}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        <StatCard icon={Users} label="Tổng Users" value={stats.totalUsers} color="bg-blue-500" />
                        <StatCard icon={UserCheck} label="Đã xác thực" value={stats.verifiedUsers} color="bg-green-500" />
                        <StatCard icon={Wifi} label="Đang online" value={stats.onlineUsers} color="bg-emerald-500" />
                        <StatCard icon={Home} label="Phòng chat" value={stats.totalRooms} color="bg-purple-500" />
                        <StatCard icon={MessageSquare} label="Tin nhắn" value={stats.totalMessages} color="bg-orange-500" />
                    </div>
                )}

                {/* Search & User Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <BarChart3 size={20} />
                            Quản lý Users
                        </h2>
                        <div className="relative w-full sm:w-80">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên, email, SĐT..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-left text-gray-500">
                                    <th className="px-4 py-3 font-medium">User</th>
                                    <th className="px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                                    <th className="px-4 py-3 font-medium hidden md:table-cell">SĐT</th>
                                    <th className="px-4 py-3 font-medium">Vai trò</th>
                                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Xác thực</th>
                                    <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                                            Không tìm thấy user nào
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                                                        {u.avatar ? (
                                                            <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            u.username?.[0]?.toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-gray-800 truncate">{u.username}</p>
                                                        <p className="text-xs text-gray-400 sm:hidden truncate">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{u.email}</td>
                                            <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                                                {u.phoneNumber || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {u.role === 'admin' && <Shield size={12} />}
                                                    {u.role === 'admin' ? 'Admin' : 'User'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${u.status === 'online' ? 'bg-green-500' :
                                                        u.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-300'
                                                    }`} />
                                                <span className="text-gray-600 text-xs capitalize">{u.status}</span>
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <button
                                                    onClick={() => handleToggleVerified(u._id)}
                                                    title={u.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                                                >
                                                    {u.isVerified ? (
                                                        <CheckCircle size={18} className="text-green-500" />
                                                    ) : (
                                                        <XCircle size={18} className="text-gray-300 hover:text-red-400" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setEditUser(u)}
                                                        className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"
                                                        title="Chỉnh sửa"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    {u._id !== currentUser?._id && (
                                                        <button
                                                            onClick={() => setDeleteUser(u)}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="px-4 py-3 border-t flex items-center justify-between text-sm text-gray-500">
                            <span>
                                Trang {pagination.page} / {pagination.totalPages} ({pagination.total} users)
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page === pagination.totalPages}
                                    className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modals */}
            {editUser && (
                <EditUserModal
                    user={editUser}
                    onClose={() => setEditUser(null)}
                    onSave={handleUpdateUser}
                />
            )}
            {deleteUser && (
                <DeleteModal
                    user={deleteUser}
                    onClose={() => setDeleteUser(null)}
                    onConfirm={handleDeleteUser}
                />
            )}
        </div>
    );
}
