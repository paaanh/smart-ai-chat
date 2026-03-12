import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { roomAPI, uploadAPI, resolveMediaUrl } from '../services/api';
import {
    ArrowLeft, Users, Edit3, Camera, Loader2, Calendar, MessageCircle,
} from 'lucide-react';
import { format } from 'date-fns';

export default function GroupProfilePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const { on, off } = useSocket();

    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null); // 'avatar' | 'cover' | null

    const avatarInputRef = useRef(null);
    const coverInputRef = useRef(null);

    const isAdmin = room?.members?.some(
        (m) => (m.user?._id || m.user) === currentUser?._id && m.role === 'admin'
    );

    const loadRoom = useCallback(async () => {
        try {
            const { data } = await roomAPI.getById(id);
            setRoom(data.room);
        } catch (err) {
            console.error('Load group error:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        setLoading(true);
        loadRoom();
    }, [loadRoom]);

    // Listen for real-time group settings updates
    useEffect(() => {
        const handleSettingsUpdate = (payload) => {
            if (payload.roomId === id) {
                setRoom((prev) =>
                    prev
                        ? {
                            ...prev,
                            name: payload.name ?? prev.name,
                            description: payload.description ?? prev.description,
                            groupAvatar: payload.groupAvatar ?? prev.groupAvatar,
                            groupBackground: payload.groupBackground ?? prev.groupBackground,
                        }
                        : prev
                );
            }
        };
        on('room:settings-updated', handleSettingsUpdate);
        return () => off('room:settings-updated', handleSettingsUpdate);
    }, [id, on, off]);

    const handleUpload = async (file, field) => {
        if (!file) return;
        setUploading(field);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data: uploadData } = await uploadAPI.uploadFile(formData);
            const url = uploadData.file?.url || uploadData.url;

            const updatePayload = field === 'avatar'
                ? { groupAvatar: url }
                : { groupBackground: url };

            const { data } = await roomAPI.updateGroupSettings(id, updatePayload);
            setRoom(data.room);
        } catch (err) {
            console.error(`Upload ${field} error:`, err);
        } finally {
            setUploading(null);
        }
    };

    const handleGoToChat = () => {
        navigate('/');
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('select-room', { detail: id }));
        }, 100);
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            </div>
        );
    }

    if (!room) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
                <p className="text-gray-500 mb-4">Không tìm thấy nhóm</p>
                <button onClick={() => navigate('/')} className="text-[var(--color-primary)] hover:underline">
                    Quay lại
                </button>
            </div>
        );
    }

    const initial = room.name?.charAt(0).toUpperCase() || '?';
    const memberCount = room.members?.length || 0;

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Top navigation */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-full transition">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="font-semibold text-gray-900">{room.name}</h1>
                </div>
            </div>

            <div className="max-w-3xl mx-auto">
                {/* ─── Cover + Avatar Header ─── */}
                <div className="relative">
                    {/* Cover photo */}
                    <div className="h-48 sm:h-64 bg-gradient-to-r from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] rounded-b-2xl overflow-hidden relative group">
                        {room.groupBackground && (
                            <img
                                src={resolveMediaUrl(room.groupBackground)}
                                alt="cover"
                                className="w-full h-full object-cover"
                            />
                        )}

                        {/* Admin: edit cover button */}
                        {isAdmin && (
                            <>
                                <input
                                    ref={coverInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleUpload(e.target.files[0], 'cover')}
                                />
                                <button
                                    onClick={() => coverInputRef.current?.click()}
                                    disabled={uploading === 'cover'}
                                    className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 bg-black/50 hover:bg-black/70 text-white text-sm rounded-xl transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                                >
                                    {uploading === 'cover' ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Camera size={14} />
                                    )}
                                    Chỉnh sửa ảnh bìa
                                </button>
                            </>
                        )}
                    </div>

                    {/* Avatar */}
                    <div className="absolute -bottom-16 left-6">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full border-4 border-white bg-purple-500 flex items-center justify-center text-white text-5xl font-bold overflow-hidden shadow-lg">
                                {room.groupAvatar ? (
                                    <img src={resolveMediaUrl(room.groupAvatar)} alt={room.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Users size={48} />
                                )}
                            </div>

                            {/* Admin: edit avatar overlay */}
                            {isAdmin && (
                                <>
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleUpload(e.target.files[0], 'avatar')}
                                    />
                                    <button
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={uploading === 'avatar'}
                                        className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition disabled:opacity-50"
                                    >
                                        {uploading === 'avatar' ? (
                                            <Loader2 size={20} className="animate-spin text-white" />
                                        ) : (
                                            <Camera size={20} className="text-white" />
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Name + Description + Actions ─── */}
                <div className="bg-white rounded-2xl mt-0 px-6 pt-20 pb-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900">{room.name}</h2>
                    {room.description && (
                        <p className="text-gray-600 mt-1">{room.description}</p>
                    )}
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                        <Users size={14} />
                        {memberCount} thành viên
                    </p>
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar size={12} />
                        Tạo ngày {room.createdAt ? format(new Date(room.createdAt), 'dd/MM/yyyy') : ''}
                    </p>

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-3 flex-wrap">
                        <button
                            onClick={handleGoToChat}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium rounded-xl transition"
                        >
                            <MessageCircle size={16} />
                            Nhắn tin nhóm
                        </button>

                        {isAdmin && (
                            <EditGroupButton room={room} onSaved={(updated) => setRoom(updated)} />
                        )}
                    </div>
                </div>

                {/* ─── Members section ─── */}
                <div className="bg-white rounded-2xl mt-4 px-6 py-5 shadow-sm mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Thành viên ({memberCount})
                    </h3>
                    <div className="space-y-3">
                        {room.members?.map((member) => {
                            const u = member.user;
                            const userId = u?._id || u;
                            const username = u?.username || 'Unknown';
                            const memberInitial = username.charAt(0).toUpperCase();
                            return (
                                <div
                                    key={userId}
                                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition"
                                    onClick={() => navigate(`/profile/${userId}`)}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-semibold overflow-hidden shrink-0">
                                        {u?.avatar ? (
                                            <img src={resolveMediaUrl(u.avatar)} alt={username} className="w-full h-full object-cover" />
                                        ) : (
                                            memberInitial
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-gray-900">{username}</span>
                                        {member.role === 'admin' && (
                                            <span className="ml-2 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Inline Edit Group Info Button + Modal ──────────────────────────
function EditGroupButton({ room, onSaved }) {
    const [show, setShow] = useState(false);
    const [name, setName] = useState(room.name || '');
    const [description, setDescription] = useState(room.description || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            const { data } = await roomAPI.updateGroupSettings(room._id, {
                name: name.trim(),
                description: description.trim(),
            });
            onSaved(data.room);
            setShow(false);
        } catch (err) {
            console.error('Update group settings error:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button
                onClick={() => { setName(room.name || ''); setDescription(room.description || ''); setShow(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition"
            >
                <Edit3 size={16} />
                Chỉnh sửa thông tin
            </button>

            {show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShow(false)}>
                    <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">Chỉnh sửa thông tin nhóm</h3>
                        </div>
                        <form onSubmit={handleSave} className="p-5 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Tên nhóm</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent"
                                    maxLength={100}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 block mb-1">Mô tả nhóm</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    maxLength={500}
                                    placeholder="Mô tả nhóm của bạn..."
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent resize-none"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShow(false)}
                                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                                >
                                    Huỷ
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !name.trim()}
                                    className="flex-1 py-2.5 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving && <Loader2 size={14} className="animate-spin" />}
                                    Lưu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
