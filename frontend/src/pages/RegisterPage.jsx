import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, Loader2, Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import { authAPI } from '../services/api';
import { useGoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleRegisterButton({ disabled, onError, onSuccess }) {
    const googleRegister = useGoogleLogin({
        onSuccess,
        onError,
    });

    return (
        <button
            type="button"
            onClick={() => googleRegister()}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 font-medium text-gray-700"
        >
            {disabled ? (
                <Loader2 size={18} className="animate-spin" />
            ) : (
                <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
            )}
            Tiếp tục với Google
        </button>
    );
}

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

export default function RegisterPage() {
    const { register, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    // Step: 1 = nhập email, 2 = nhập OTP, 3 = thông tin đăng ký
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [form, setForm] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        preferredLanguage: 'vi',
    });
    const [showPwd, setShowPwd] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [resending, setResending] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const otpRefs = useRef([]);

    // Đếm ngược cooldown
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Auto-focus OTP input
    useEffect(() => {
        if (step === 2) otpRefs.current[0]?.focus();
    }, [step]);

    // ── Step 1: Gửi OTP đến email ──
    const handleSendOTP = useCallback(async (e) => {
        e.preventDefault();
        if (cooldown > 0) return;
        setError('');
        setLoading(true);
        try {
            await authAPI.sendRegisterOTP({ email });
            setCooldown(60);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể gửi mã OTP');
        } finally {
            setLoading(false);
        }
    }, [email, cooldown]);

    // ── OTP input handlers ──
    const handleOtpChange = useCallback((index, value) => {
        if (value && !/^\d$/.test(value)) return;
        setOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = value;
            return newOtp;
        });
        if (value && index < 5) otpRefs.current[index + 1]?.focus();
    }, []);

    const handleOtpKeyDown = useCallback((index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    }, [otp]);

    const handleOtpPaste = useCallback((e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const newOtp = ['', '', '', '', '', ''];
        for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
        setOtp(newOtp);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }, []);

    // ── Step 2: Xác nhận OTP → chuyển bước 3 ──
    const handleVerifyOTP = useCallback((e) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Vui lòng nhập đủ 6 số OTP');
            return;
        }
        setError('');
        setStep(3);
    }, [otp]);

    // ── Gửi lại OTP ──
    const handleResendOTP = useCallback(async () => {
        if (cooldown > 0) return;
        setResending(true);
        setError('');
        try {
            await authAPI.sendRegisterOTP({ email });
            setCooldown(60);
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể gửi lại mã');
        } finally {
            setResending(false);
        }
    }, [cooldown, email]);

    // ── Step 3: Đăng ký với OTP ──
    const handleRegister = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        if (form.password !== form.confirmPassword) {
            setError('Mật khẩu không khớp');
            return;
        }
        if (form.password.length < 6) {
            setError('Mật khẩu tối thiểu 6 ký tự');
            return;
        }

        setLoading(true);
        try {
            const langObj = LANGUAGES.find((l) => l.code === form.preferredLanguage);
            await register({
                username: form.username,
                email,
                password: form.password,
                otp: otp.join(''),
                preferredLanguage: form.preferredLanguage,
                preferredLanguageLabel: langObj?.label || form.preferredLanguage,
            });
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Đăng ký thất bại');
            // Nếu OTP lỗi, quay lại step 2
            if (err.response?.data?.error?.includes('OTP')) {
                setStep(2);
                setOtp(['', '', '', '', '', '']);
            }
        } finally {
            setLoading(false);
        }
    }, [form, email, otp, register, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--color-primary-light)] to-[var(--color-primary-medium)] px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-primary)] rounded-2xl mb-4">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản</h1>
                    <p className="text-gray-500 mt-1">
                        {step === 1 && 'Nhập email để bắt đầu'}
                        {step === 2 && 'Xác thực email của bạn'}
                        {step === 3 && 'Hoàn tất thông tin đăng ký'}
                    </p>

                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`h-2 rounded-full transition-all ${s === step ? 'w-8 bg-[var(--color-primary)]' : s < step ? 'w-8 bg-[var(--color-primary)] opacity-50' : 'w-8 bg-gray-300'}`} />
                        ))}
                    </div>
                </div>

                {/* ── Step 1: Nhập email ── */}
                {step === 1 && (
                    <form onSubmit={handleSendOTP} className="bg-white rounded-2xl shadow-lg p-8 space-y-5">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                                    placeholder="you@example.com"
                                />
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || cooldown > 0}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi mã xác nhận'}
                            {!loading && cooldown <= 0 && <ArrowRight size={18} />}
                        </button>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="bg-white px-3 text-gray-400">hoặc</span>
                            </div>
                        </div>

                        {/* Google Register */}
                        {GOOGLE_CLIENT_ID && (
                            <GoogleRegisterButton
                                disabled={googleLoading}
                                onSuccess={async (tokenResponse) => {
                                    setGoogleLoading(true);
                                    try {
                                        await loginWithGoogle({ credential: tokenResponse.access_token });
                                        navigate('/');
                                    } catch (err) {
                                        setError(err.response?.data?.error || 'Đăng ký Google thất bại');
                                    } finally {
                                        setGoogleLoading(false);
                                    }
                                }}
                                onError={() => {
                                    setError('Đăng ký Google thất bại');
                                    setGoogleLoading(false);
                                }}
                            />
                        )}

                        <p className="text-center text-sm text-gray-500">
                            Đã có tài khoản?{' '}
                            <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium">
                                Đăng nhập
                            </Link>
                        </p>
                    </form>
                )}

                {/* ── Step 2: Nhập OTP ── */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOTP} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                        )}

                        <p className="text-sm text-gray-500 text-center">
                            Mã xác nhận đã gửi đến <span className="font-medium text-gray-700">{email}</span>
                        </p>

                        <div className="flex justify-center gap-3">
                            {otp.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={(el) => (otpRefs.current[i] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                    onPaste={i === 0 ? handleOtpPaste : undefined}
                                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary)] outline-none transition"
                                />
                            ))}
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                        >
                            Xác nhận
                            <ArrowRight size={18} />
                        </button>

                        <div className="text-center text-sm text-gray-500">
                            Chưa nhận được mã?{' '}
                            <button
                                type="button"
                                onClick={handleResendOTP}
                                disabled={cooldown > 0 || resending}
                                className="text-[var(--color-primary)] hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                            >
                                {resending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
                            </button>
                        </div>

                        <p className="text-center text-sm">
                            <button type="button" onClick={() => { setStep(1); setError(''); }} className="text-[var(--color-primary)] hover:underline font-medium inline-flex items-center gap-1">
                                <ArrowLeft size={14} />
                                Đổi email khác
                            </button>
                        </p>
                    </form>
                )}

                {/* ── Step 3: Thông tin đăng ký ── */}
                {step === 3 && (
                    <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                        )}

                        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                            <Mail size={16} />
                            Email <span className="font-medium">{email}</span> đã xác thực
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                            <input
                                type="text"
                                required
                                minLength={2}
                                value={form.username}
                                onChange={(e) => setForm({ ...form, username: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                                placeholder="Nguyễn Văn A"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ngôn ngữ ưu tiên</label>
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    required
                                    minLength={6}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition pr-10"
                                    placeholder="Tối thiểu 6 ký tự"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                            <input
                                type={showPwd ? 'text' : 'password'}
                                required
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition"
                                placeholder="Nhập lại mật khẩu"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            Đăng ký
                        </button>

                        <p className="text-center text-sm text-gray-500">
                            Đã có tài khoản?{' '}
                            <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium">
                                Đăng nhập
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
