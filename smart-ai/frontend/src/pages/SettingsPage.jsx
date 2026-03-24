import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { userAPI } from '../services/api';
import { ArrowLeft, Loader2, Check, Palette, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function SettingsPage() {
    const { user, updateUser, logout } = useAuth();
    const { themeId, changeTheme, themes } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: user?.username || '',
        phoneNumber: user?.phoneNumber || '',
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [pendingThemeId, setPendingThemeId] = useState(null);
    const [pressedThemeId, setPressedThemeId] = useState(null);
    const themeSwitchTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (themeSwitchTimerRef.current) {
                clearTimeout(themeSwitchTimerRef.current);
            }
        };
    }, []);

    const hexToRgba = (hex, alpha = 0.4) => {
        if (!hex) return `rgba(99, 102, 241, ${alpha})`;
        let value = hex.replace('#', '').trim();
        if (value.length === 3) {
            value = value.split('').map((c) => c + c).join('');
        }
        if (!/^[0-9a-fA-F]{6}$/.test(value)) {
            return `rgba(99, 102, 241, ${alpha})`;
        }
        const parsed = Number.parseInt(value, 16);
        const r = (parsed >> 16) & 255;
        const g = (parsed >> 8) & 255;
        const b = parsed & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getThemeAccent = (theme) => {
        if (theme.id === 'light') return '#6366f1';
        if (theme.id === 'dark') return '#818cf8';
        if (theme.id === 'pixel-art') return '#f59e0b';
        if (theme.id === 'neon-night') return '#22d3ee';
        return theme.color || '#6366f1';
    };

    const getThemePreviewBackground = (theme) => {
        if (theme.id === 'dark') return 'linear-gradient(135deg, #1e293b, #0f172a)';
        if (theme.id === 'light') return 'linear-gradient(135deg, #f8fafc, #e2e8f0)';
        if (theme.id === 'pixel-art') return 'linear-gradient(135deg, #f59e0b, #ef4444)';
        if (theme.id === 'neon-night') return 'linear-gradient(135deg, #22d3ee, #fb7185)';
        return theme.color;
    };

    const handleSave = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await userAPI.updateProfile({
                username: form.username,
                phoneNumber: form.phoneNumber,
                preferredLanguage: 'vi',
                preferredLanguageLabel: 'Tiếng Việt',
                preferredTheme: themeId,
            });
            updateUser(data.user);
            localStorage.setItem('preferredLanguage', 'vi');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.error || t('settings.saveFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleThemeChange = (newThemeId) => {
        if (pendingThemeId === newThemeId) return;

        if (themeSwitchTimerRef.current) {
            clearTimeout(themeSwitchTimerRef.current);
        }

        setPressedThemeId(newThemeId);
        setPendingThemeId(newThemeId);

        themeSwitchTimerRef.current = setTimeout(() => {
            changeTheme(newThemeId);
            // Also persist to backend silently
            userAPI.updateProfile({ preferredTheme: newThemeId }).catch(() => { });
            setPendingThemeId(null);
            themeSwitchTimerRef.current = null;
        }, 320);

        setTimeout(() => {
            setPressedThemeId((prev) => (prev === newThemeId ? null : prev));
        }, 420);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="p-1 hover:bg-gray-100 rounded-full" title={t('settings.backToChat')}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-lg font-semibold">{t('settings.title')}</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Profile section */}
                <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
                    <h2 className="font-semibold text-gray-900">{t('settings.profileSection')}</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.displayName')}</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.email')}</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.phoneNumber')}</label>
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
                                {t('common.saved')}
                            </>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                </div>

                {/* Theme / Appearance section */}
                <div className="bg-[var(--bg-card)] rounded-xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <Palette size={18} className="text-[var(--color-primary)]" />
                        <h2 className="font-semibold text-[var(--text-primary)]">{t('settings.appearanceSection')}</h2>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        {t('settings.appearanceHelp')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {themes.map((theme) => {
                            const isActive = themeId === theme.id;
                            const isPending = pendingThemeId === theme.id;
                            const accent = getThemeAccent(theme);

                            return (
                                <motion.button
                                key={theme.id}
                                type="button"
                                onClick={() => handleThemeChange(theme.id)}
                                title={theme.name}
                                whileHover={{
                                    scale: isActive ? 1.12 : 1.08,
                                    boxShadow: `0 0 0 4px ${hexToRgba(accent, 0.25)}, 0 0 24px ${hexToRgba(accent, 0.45)}`,
                                }}
                                whileTap={{ scale: 0.9 }}
                                animate={pressedThemeId === theme.id
                                    ? {
                                        scale: [1, 0.9, isActive ? 1.14 : 1.1, isActive ? 1.1 : 1],
                                        transition: { duration: 0.38, times: [0, 0.28, 0.68, 1] },
                                    }
                                    : {
                                        scale: isActive ? 1.1 : 1,
                                        transition: { duration: 0.2, ease: 'easeOut' },
                                    }}
                                className={`relative w-12 h-12 rounded-full transition-colors duration-200 border-2 flex items-center justify-center
                                    ${isActive || isPending
                                        ? 'border-[var(--color-primary)]'
                                        : 'border-transparent'}
                                `}
                                style={{
                                    background: getThemePreviewBackground(theme),
                                    boxShadow: isActive
                                        ? `0 8px 18px ${hexToRgba(accent, 0.45)}`
                                        : `0 4px 10px ${hexToRgba(accent, 0.18)}`,
                                }}
                            >
                                {isPending && (
                                    <span
                                        className="pointer-events-none absolute -inset-1.5 rounded-full border-2 border-transparent animate-spin"
                                        style={{
                                            borderTopColor: accent,
                                            borderRightColor: hexToRgba(accent, 0.5),
                                        }}
                                    />
                                )}

                                {isActive && !isPending && (
                                    <Check size={18} className={theme.id === 'light' ? 'text-gray-800' : 'text-white'} />
                                )}

                                {isPending && (
                                    <Loader2
                                        size={14}
                                        className={`absolute animate-spin ${theme.id === 'light' ? 'text-gray-800' : 'text-white'}`}
                                    />
                                )}
                            </motion.button>
                            );
                        })}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {t('settings.usingTheme')} <span className="font-medium text-[var(--color-primary)]">{themes.find((theme) => theme.id === (pendingThemeId || themeId))?.name}</span>
                    </p>

                </div>

                {/* Danger zone */}
                <div className="bg-white rounded-xl p-6 shadow-sm">
                    <h2 className="font-semibold text-red-600 mb-3">{t('settings.logoutSection')}</h2>
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-medium py-2.5 rounded-lg transition"
                    >
                        {t('settings.logoutButton')}
                    </button>
                </div>
            </div>
        </div>
    );
}
