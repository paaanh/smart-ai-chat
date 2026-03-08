/**
 * AppRoutes.jsx — Route definitions separated from providers.
 *
 * PrivateRoute / PublicRoute use the useAuth() hook for reactive
 * auth state. The route TABLE itself is a pure declarative map
 * with no auth logic at the top level.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Loader2 } from 'lucide-react';

// ── Lazy-loaded pages ──────────────────────────────────────────
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const VerifyOTPPage = lazy(() => import('../pages/VerifyOTPPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const ChatPage = lazy(() => import('../pages/ChatPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const GroupProfilePage = lazy(() => import('../pages/GroupProfilePage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));

// ── Loading fallback ───────────────────────────────────────────
function LoadingScreen() {
    return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
        </div>
    );
}

// ── Route guards ───────────────────────────────────────────────
function PrivateRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    return user ? <Navigate to="/" replace /> : children;
}

// ── Route table ────────────────────────────────────────────────
export default function AppRoutes() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <Routes>
                <Route
                    path="/login"
                    element={
                        <PublicRoute>
                            <LoginPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/register"
                    element={
                        <PublicRoute>
                            <RegisterPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/forgot-password"
                    element={
                        <PublicRoute>
                            <ForgotPasswordPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/verify-otp"
                    element={
                        <PublicRoute>
                            <VerifyOTPPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/reset-password"
                    element={
                        <PublicRoute>
                            <ResetPasswordPage />
                        </PublicRoute>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <PrivateRoute>
                            <SettingsPage />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/profile/:id"
                    element={
                        <PrivateRoute>
                            <ProfilePage />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/group/:id"
                    element={
                        <PrivateRoute>
                            <GroupProfilePage />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/admin"
                    element={
                        <PrivateRoute>
                            <AdminPage />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <ChatPage />
                        </PrivateRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}
