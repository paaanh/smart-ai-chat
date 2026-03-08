import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;
    const otp = location.state?.otp;

    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    // Redirect nếu thiếu dữ liệu
    useEffect(() => {
        if (!email || !otp) navigate('/forgot-password', { replace: true });
    }, [email, otp, navigate]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError('');

        if (form.password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Mật khẩu xác nhận không khớp');
            return;
        }

        setLoading(true);
        try {
            await authAPI.resetPassword({ email, otp, newPassword: form.password });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Đặt lại mật khẩu thất bại');
        } finally {
            setLoading(false);
        }
    }, [form, email, otp]);

    if (!email || !otp) return null;

    // Màn hình thành công
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--color-primary-light)] to-[var(--color-primary-medium)] px-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Đặt lại mật khẩu thành công!</h2>
                        <p className="text-gray-500 text-sm">Bạn có thể đăng nhập bằng mật khẩu mới.</p>
                        <button
                            onClick={() => navigate('/login', { replace: true })}
                            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition"
                        >
                            Đăng nhập ngay
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[var(--color-primary-light)] to-[var(--color-primary-medium)] px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[var(--color-primary)] rounded-2xl mb-4">
                        <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Đặt lại mật khẩu</h1>
                    <p className="text-gray-500 mt-1">Nhập mật khẩu mới cho tài khoản của bạn</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                        <div className="relative">
                            <input
                                type={showPwd ? 'text' : 'password'}
                                required
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition pr-10"
                                placeholder="Ít nhất 6 ký tự"
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
                        <div className="relative">
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                required
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none transition pr-10"
                                placeholder="Nhập lại mật khẩu mới"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 size={18} className="animate-spin" />}
                        Đặt lại mật khẩu
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
