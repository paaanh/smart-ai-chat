import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { userAPI, friendAPI, roomAPI, resolveMediaUrl } from '../services/api';
import {
    ArrowLeft, MapPin, GraduationCap, Phone, Mail, Heart, Edit3,
    MessageCircle, UserX, Loader2, Calendar, Shield, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import EditProfileModal from '../components/profile/EditProfileModal';

export default function ProfilePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user: currentUser, updateUser } = useAuth();
    const { on, off } = useSocket();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [friendStatus, setFriendStatus] = useState(null);
    const [friendshipId, setFriendshipId] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const isOwn = currentUser?._id === id;

    const loadProfile = useCallback(async () => {
        try {
            const { data } = await userAPI.getById(id);
            setProfile(data.user);
        } catch (err) {
            console.error('Load profile error:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        setLoading(true);
        loadProfile();
    }, [loadProfile]);

    // Load friend status for other users
    useEffect(() => {
        if (isOwn || !id) return;
        friendAPI.getStatus(id).then(({ data }) => {
            setFriendStatus(data.status);
            setFriendshipId(data.friendshipId);
        }).catch(() => { });
    }, [id, isOwn]);

    // Listen for real-time profile updates
    useEffect(() => {
        const handleProfileUpdate = ({ userId, ...updates }) => {
            if (userId === id) {
                setProfile(prev => prev ? { ...prev, ...updates } : prev);
            }
        };
        on('user:profile-updated', handleProfileUpdate);
        return () => off('user:profile-updated', handleProfileUpdate);
    }, [id, on, off]);

    const handleMessage = async () => {
        try {
            const { data } = await roomAPI.create({ type: 'direct', memberIds: [id] });
            navigate('/', { state: { roomId: data.room._id } });
        } catch (err) {
            console.error('Start chat error:', err);
        }
    };

    const handleUnfriend = async () => {
        if (!friendshipId) return;
        setActionLoading(true);
        try {
            await friendAPI.remove(friendshipId);
            setFriendStatus('none');
            setFriendshipId(null);
        } catch (err) {
            console.error('Unfriend error:', err);
        } finally {
            setActionLoading(false);
        }
    };

    const handleProfileSaved = (updatedUser) => {
        setProfile(updatedUser);
        if (isOwn) updateUser(updatedUser);
        setShowEdit(false);
    };

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
                <p className="text-gray-500 mb-4">Không tìm thấy người dùng</p>
                <button onClick={() => navigate('/')} className="text-[var(--color-primary)] hover:underline">Quay lại</button>
            </div>
        );
    }

    const initial = profile.username?.charAt(0).toUpperCase() || '?';

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Top navigation */}
            <div className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-full transition">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="font-semibold text-gray-900">{profile.username}</h1>
                </div>
            </div>

            <div className="max-w-3xl mx-auto">
                {/* ─── Cover + Avatar Header ─── */}
                <div className="relative">
                    {/* Cover photo */}
                    <div className="h-48 sm:h-64 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-gradient-to)] rounded-b-2xl overflow-hidden">
                        {profile.coverPicture && (
                            <img
                                src={resolveMediaUrl(profile.coverPicture)}
                                alt="cover"
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    {/* Avatar */}
                    <div className="absolute -bottom-16 left-6">
                        <div className="w-32 h-32 rounded-full border-4 border-white bg-[var(--color-primary)] flex items-center justify-center text-white text-5xl font-bold overflow-hidden shadow-lg">
                            {(profile.avatar || profile.googlePicture) ? (
                                <img src={resolveMediaUrl(profile.avatar || profile.googlePicture)} alt={profile.username} className="w-full h-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Name + Bio + Actions ─── */}
                <div className="bg-white rounded-2xl mt-0 px-6 pt-20 pb-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-gray-900">{profile.username}</h2>
                    {profile.bio && (
                        <p className="text-gray-600 mt-1">{profile.bio}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar size={12} />
                        Tham gia {profile.createdAt ? format(new Date(profile.createdAt), 'dd/MM/yyyy') : ''}
                    </p>

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-3">
                        {isOwn ? (
                            <button
                                onClick={() => setShowEdit(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition"
                            >
                                <Edit3 size={16} />
                                Chỉnh sửa trang cá nhân
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleMessage}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium rounded-xl transition"
                                >
                                    <MessageCircle size={16} />
                                    Nhắn tin
                                </button>
                                
                                {(!friendStatus || friendStatus === 'none') && (
                                    <button
                                        onClick={async () => {
                                            setActionLoading(true);
                                            try {
                                                await friendAPI.sendRequest(id);
                                                setFriendStatus('pending');
                                            } catch (err) {
                                                console.error('Add friend error:', err);
                                            } finally {
                                                setActionLoading(false);
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-medium rounded-xl transition disabled:opacity-50"
                                    >
                                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                                        Kết bạn
                                    </button>
                                )}

                                {friendStatus === 'pending' && (
                                    <button
                                        disabled={true}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-500 font-medium rounded-xl disabled:opacity-75"
                                    >
                                        Đã gửi yêu cầu
                                    </button>
                                )}

                                {friendStatus === 'accepted' && (
                                    <button
                                        onClick={handleUnfriend}
                                        disabled={actionLoading}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl transition disabled:opacity-50"
                                    >
                                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />}
                                        Hủy kết bạn
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ─── Info Section ─── */}
                <div className="bg-white rounded-2xl mt-4 px-6 py-5 shadow-sm mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Giới thiệu</h3>
                    <div className="space-y-3">
                        {/* Phương thức đăng nhập */}
                        {isOwn && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Shield size={18} className="text-gray-400 shrink-0" />
                                <span>Phương thức đăng nhập: <strong>{
                                    profile.provider === 'google' ? 'Google' : 'Email & Mật khẩu'
                                }</strong></span>
                                {profile.provider === 'google' && (
                                    <svg width="16" height="16" viewBox="0 0 48 48" className="shrink-0">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                )}
                            </div>
                        )}
                        {profile.address && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <MapPin size={18} className="text-gray-400 shrink-0" />
                                <span>Sống tại <strong>{profile.address}</strong></span>
                            </div>
                        )}
                        {profile.education && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <GraduationCap size={18} className="text-gray-400 shrink-0" />
                                <span>Học tại <strong>{profile.education}</strong></span>
                            </div>
                        )}
                        {profile.phoneNumber && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Phone size={18} className="text-gray-400 shrink-0" />
                                <span>{profile.phoneNumber}</span>
                            </div>
                        )}
                        {profile.email && (
                            <div className="flex items-center gap-3 text-gray-700">
                                <Mail size={18} className="text-gray-400 shrink-0" />
                                <span>{profile.email}</span>
                            </div>
                        )}
                        {profile.hobbies?.length > 0 && (
                            <div className="flex items-start gap-3 text-gray-700">
                                <Heart size={18} className="text-gray-400 shrink-0 mt-0.5" />
                                <div className="flex flex-wrap gap-2">
                                    {profile.hobbies.map((hobby, i) => (
                                        <span key={i} className="px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] rounded-full text-sm">
                                            {hobby}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!profile.address && !profile.education && !profile.phoneNumber && !profile.hobbies?.length && !isOwn && (
                            <p className="text-gray-400 italic">Chưa có thông tin giới thiệu</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Profile Modal */}
            {showEdit && (
                <EditProfileModal
                    profile={profile}
                    onClose={() => setShowEdit(false)}
                    onSaved={handleProfileSaved}
                />
            )}
        </div>
    );
}
