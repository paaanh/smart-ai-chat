import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Mail, Loader2, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // Đếm ngược cooldown
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (cooldown > 0) return;

        setError('');
        setLoading(true);
        try {
            await authAPI.forgotPassword({ email });
            setCooldown(60);
            navigate('/verify-otp', { state: { email } });
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể gửi mã OTP. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }, [email, cooldown, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--color-primary-light)] to-[var(--color-primary-medium)] px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-primary)] rounded-2xl mb-4">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Quên mật khẩu</h1>
                    <p className="text-gray-500 mt-1">Nhập email để nhận mã xác nhận</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-5">
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
                        {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi mã xác nhận'}
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        <Link to="/login" className="text-[var(--color-primary)] hover:underline font-medium inline-flex items-center gap-1">
                            <ArrowLeft size={14} />
                            Quay lại đăng nhập
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
