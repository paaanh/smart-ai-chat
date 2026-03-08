import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MessageCircle, Loader2, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services/api';

export default function VerifyOTPPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(60);
    const [resending, setResending] = useState(false);
    const inputRefs = useRef([]);

    // Redirect nếu không có email
    useEffect(() => {
        if (!email) navigate('/forgot-password', { replace: true });
    }, [email, navigate]);

    // Đếm ngược cooldown
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // Auto-focus ô đầu tiên
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = useCallback((index, value) => {
        // Chỉ cho phép số
        if (value && !/^\d$/.test(value)) return;

        setOtp(prev => {
            const newOtp = [...prev];
            newOtp[index] = value;
            return newOtp;
        });

        // Auto-focus ô tiếp theo
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }, []);

    const handleKeyDown = useCallback((index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }, [otp]);

    const handlePaste = useCallback((e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        const newOtp = ['', '', '', '', '', ''];
        for (let i = 0; i < pasted.length; i++) {
            newOtp[i] = pasted[i];
        }
        setOtp(newOtp);
        inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }, []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const otpString = otp.join('');
        if (otpString.length !== 6) {
            setError('Vui lòng nhập đủ 6 số OTP');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await authAPI.verifyOTP({ email, otp: otpString });
            navigate('/reset-password', { state: { email, otp: otpString } });
        } catch (err) {
            setError(err.response?.data?.error || 'Xác thực OTP thất bại');
        } finally {
            setLoading(false);
        }
    }, [otp, email, navigate]);

    const handleResend = useCallback(async () => {
        if (cooldown > 0) return;
        setResending(true);
        setError('');
        try {
            await authAPI.forgotPassword({ email });
            setCooldown(60);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể gửi lại mã');
        } finally {
            setResending(false);
        }
    }, [cooldown, email]);

    if (!email) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--color-primary-light)] to-[var(--color-primary-medium)] px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-primary)] rounded-2xl mb-4">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Nhập mã OTP</h1>
                    <p className="text-gray-500 mt-1">
                        Mã xác nhận đã gửi đến <span className="font-medium text-gray-700">{email}</span>
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                    )}

                    {/* 6 ô nhập OTP */}
                    <div className="flex justify-center gap-3">
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => (inputRefs.current[i] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                onPaste={i === 0 ? handlePaste : undefined}
                                className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary)] outline-none transition"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        Xác nhận
                    </button>

                    {/* Gửi lại mã */}
                    <div className="text-center text-sm text-gray-500">
                        Chưa nhận được mã?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || resending}
                            className="text-[var(--color-primary)] hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                        >
                            {resending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
                        </button>
                    </div>

                    <p className="text-center text-sm text-gray-500">
                        <Link to="/forgot-password" className="text-[var(--color-primary)] hover:underline font-medium inline-flex items-center gap-1">
                            <ArrowLeft size={14} />
                            Đổi email khác
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
