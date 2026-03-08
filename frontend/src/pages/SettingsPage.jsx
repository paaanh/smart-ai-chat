import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { userAPI } from '../services/api';
import { ArrowLeft, Loader2, Check, Palette, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'zh', label: '中文' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'th', label: 'ไทย' },
    { code: 'ru', label: 'Русский' },
    { code: 'pt', label: 'Português' },
    { code: 'ar', label: 'العربية' },
];

export default function SettingsPage() {
    const { user, updateUser, logout } = useAuth();
    const { themeId, changeTheme, themes } = useTheme();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: user?.username || '',
        phoneNumber: user?.phoneNumber || '',
        preferredLanguage: user?.preferredLanguage || 'vi',
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setError('');
        setLoading(true);
        try {
            const langObj = LANGUAGES.find((l) => l.code === form.preferredLanguage);
            const { data } = await userAPI.updateProfile({
                username: form.username,
                phoneNumber: form.phoneNumber,
                preferredLanguage: form.preferredLanguage,
                preferredLanguageLabel: langObj?.label,
                preferredTheme: themeId,
            });
            updateUser(data.user);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Cập nhật thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleThemeChange = (newThemeId) => {
        changeTheme(newThemeId);
        // Also persist to backend silently
        userAPI.updateProfile({ preferredTheme: newThemeId }).catch(() => { });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-1 hover:bg-gray-100 rounded-full">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-semibold">Cài đặt</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Profile section */}
                <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
                    <h2 className="font-semibold text-gray-900">Hồ sơ</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                        <div className="relative">
                            <input
                                type="tel"
                                value={form.phoneNumber}
                                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                                placeholder="0912 345 678"
                            />
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ ưu tiên</label>
                        <p className="text-xs text-gray-400 mb-2">
                            Tin nhắn từ người khác sẽ được dịch sang ngôn ngữ này
                        </p>
                        <select
                            value={form.preferredLanguage}
                            onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition bg-white"
                        >
                            {LANGUAGES.map((l) => (
                                <option key={l.code} value={l.code}>
                                    {l.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : saved ? (
                            <>
                                <Check size={16} />
                                Đã lưu!
                            </>
                        ) : (
                            'Lưu thay đổi'
                        )}
                    </button>
                </div>

                {/* Theme / Appearance section */}
                <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <Palette size={18} className="text-[var(--color-primary)]" />
                        <h2 className="font-semibold text-[var(--text-primary)]">Giao diện</h2>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        Chọn màu chủ đạo cho ứng dụng. Thay đổi sẽ áp dụng ngay lập tức.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {themes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => handleThemeChange(t.id)}
                                title={t.name}
                                className={`relative w-12 h-12 rounded-full transition-all duration-200 border-2 flex items-center justify-center
                                    ${themeId === t.id
                                        ? 'border-[var(--color-primary)] scale-110 shadow-lg'
                                        : 'border-transparent hover:scale-105 hover:shadow-md'}
                                `}
                                style={{
                                    background: t.id === 'dark'
                                        ? 'linear-gradient(135deg, #1e293b, #0f172a)'
                                        : t.id === 'light'
                                            ? 'linear-gradient(135deg, #f8fafc, #e2e8f0)'
                                            : t.color,
                                }}
                            >
                                {themeId === t.id && (
                                    <Check size={18} className={t.id === 'light' ? 'text-gray-800' : 'text-white'} />
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        Đang dùng: <span className="font-medium text-[var(--color-primary)]">{themes.find(t => t.id === themeId)?.name}</span>
                    </p>
                </div>

                {/* Danger zone */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h2 className="font-semibold text-red-600 mb-3">Đăng xuất</h2>
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-medium py-2.5 rounded-lg transition"
                    >
                        Đăng xuất khỏi tài khoản
                    </button>
                </div>
            </div>
        </div>
    );
}
