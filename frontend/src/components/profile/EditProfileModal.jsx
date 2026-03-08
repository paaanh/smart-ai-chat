import { useState, useRef, useMemo, useEffect } from 'react';
import { X, Camera, Loader2, Plus, Trash2 } from 'lucide-react';
import { userAPI } from '../../services/api';

export default function EditProfileModal({ profile, onClose, onSaved }) {
    const [form, setForm] = useState({
        username: profile.username || '',
        bio: profile.bio || '',
        phoneNumber: profile.phoneNumber || '',
        address: profile.address || '',
        education: profile.education || '',
        hobbies: profile.hobbies || [],
    });
    const [hobbyInput, setHobbyInput] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const avatarInputRef = useRef(null);
    const coverInputRef = useRef(null);

    const avatarPreview = useMemo(() => {
        if (avatarFile) return URL.createObjectURL(avatarFile);
        return profile.avatar || null;
    }, [avatarFile, profile.avatar]);

    const coverPreview = useMemo(() => {
        if (coverFile) return URL.createObjectURL(coverFile);
        return profile.coverPicture || null;
    }, [coverFile, profile.coverPicture]);

    useEffect(() => {
        return () => {
            if (avatarFile) URL.revokeObjectURL(avatarPreview);
            if (coverFile) URL.revokeObjectURL(coverPreview);
        };
    }, [avatarFile, coverFile]);

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const addHobby = () => {
        const trimmed = hobbyInput.trim();
        if (trimmed && !form.hobbies.includes(trimmed)) {
            setForm(prev => ({ ...prev, hobbies: [...prev.hobbies, trimmed] }));
        }
        setHobbyInput('');
    };

    const removeHobby = (index) => {
        setForm(prev => ({ ...prev, hobbies: prev.hobbies.filter((_, i) => i !== index) }));
    };

    const handleHobbyKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addHobby();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username.trim()) {
            setError('Tên không được để trống');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('username', form.username.trim());
            formData.append('bio', form.bio);
            formData.append('phoneNumber', form.phoneNumber);
            formData.append('address', form.address);
            formData.append('education', form.education);
            formData.append('hobbies', JSON.stringify(form.hobbies));
            if (avatarFile) formData.append('avatar', avatarFile);
            if (coverFile) formData.append('coverPicture', coverFile);

            const { data } = await userAPI.updateProfile(formData);
            onSaved(data.user);
        } catch (err) {
            setError(err.response?.data?.error || 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
                    <h2 className="text-lg font-bold text-gray-900">Chỉnh sửa trang cá nhân</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Cover Photo */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Ảnh bìa</label>
                        <div
                            className="h-32 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-gradient-to)] rounded-xl overflow-hidden relative cursor-pointer group"
                            onClick={() => coverInputRef.current?.click()}
                        >
                            {coverPreview && (
                                <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <Camera size={24} className="text-white" />
                            </div>
                        </div>
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && setCoverFile(e.target.files[0])}
                        />
                    </div>

                    {/* Avatar */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Ảnh đại diện</label>
                        <div
                            className="w-24 h-24 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-3xl font-bold overflow-hidden relative cursor-pointer group mx-auto"
                            onClick={() => avatarInputRef.current?.click()}
                        >
                            {avatarPreview ? (
                                <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                profile.username?.charAt(0).toUpperCase()
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-full">
                                <Camera size={20} className="text-white" />
                            </div>
                        </div>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && setAvatarFile(e.target.files[0])}
                        />
                    </div>

                    {/* Username */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Tên hiển thị</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={handleChange('username')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                            maxLength={30}
                        />
                    </div>

                    {/* Bio */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Tiểu sử</label>
                        <textarea
                            value={form.bio}
                            onChange={handleChange('bio')}
                            rows={2}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition resize-none"
                            maxLength={200}
                            placeholder="Giới thiệu về bạn..."
                        />
                        <p className="text-xs text-gray-400 text-right">{form.bio.length}/200</p>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Số điện thoại</label>
                        <input
                            type="tel"
                            value={form.phoneNumber}
                            onChange={handleChange('phoneNumber')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                            placeholder="0123 456 789"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Địa chỉ</label>
                        <input
                            type="text"
                            value={form.address}
                            onChange={handleChange('address')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                            placeholder="Thành phố, Quốc gia"
                        />
                    </div>

                    {/* Education */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Học vấn</label>
                        <input
                            type="text"
                            value={form.education}
                            onChange={handleChange('education')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                            placeholder="Trường, ngành học..."
                        />
                    </div>

                    {/* Hobbies */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Sở thích</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {form.hobbies.map((h, i) => (
                                <span key={i} className="flex items-center gap-1 px-3 py-1 bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] rounded-full text-sm">
                                    {h}
                                    <button type="button" onClick={() => removeHobby(i)} className="hover:text-red-500">
                                        <Trash2 size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={hobbyInput}
                                onChange={(e) => setHobbyInput(e.target.value)}
                                onKeyDown={handleHobbyKeyDown}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                                placeholder="Thêm sở thích..."
                            />
                            <button
                                type="button"
                                onClick={addHobby}
                                className="p-2 bg-[var(--color-primary-medium)] text-[var(--color-primary)] rounded-xl hover:bg-[var(--color-primary-medium)] transition"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && <p className="text-sm text-red-500">{error}</p>}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </form>
            </div>
        </div>
    );
}
