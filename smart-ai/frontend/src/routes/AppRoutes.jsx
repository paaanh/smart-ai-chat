/**
 * AppRoutes.jsx — Route definitions separated from providers.
 *
 * PrivateRoute / PublicRoute use the useAuth() hook for reactive
 * auth state. The route TABLE itself is a pure declarative map
 * with no auth logic at the top level.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';

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
const CounselingPage = lazy(() => import('../pages/CounselingPage'));

// ── Loading fallback ───────────────────────────────────────────
function LoadingScreen() {
    return (
        <div className="h-dvh p-4 md:p-6 bg-gray-50">
            <div className="mx-auto h-full max-w-6xl grid gap-4 md:grid-cols-[20rem_1fr]">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                    <div className="skeleton-shimmer h-8 w-36 rounded-lg" />
                    <div className="skeleton-shimmer h-10 w-full rounded-xl" />
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={`loading-room-${idx}`} className="flex items-center gap-3">
                            <div className="skeleton-shimmer h-11 w-11 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="skeleton-shimmer h-3 w-28 rounded-md" />
                                <div className="skeleton-shimmer h-3 w-40 rounded-md" />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="skeleton-shimmer h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <div className="skeleton-shimmer h-3 w-28 rounded-md" />
                            <div className="skeleton-shimmer h-3 w-20 rounded-md" />
                        </div>
                    </div>

                    <div className="flex-1 space-y-3">
                        {Array.from({ length: 7 }).map((_, idx) => (
                            <div key={`loading-msg-${idx}`} className={`flex ${idx % 3 === 0 ? 'justify-end' : 'justify-start'}`}>
                                <div className="space-y-2 max-w-[75%]">
                                    <div className="skeleton-shimmer h-3 w-12 rounded-md" />
                                    <div className={`skeleton-shimmer h-10 rounded-2xl ${idx % 2 === 0 ? 'w-40' : 'w-56 max-w-[72vw]'}`} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="skeleton-shimmer h-12 w-full rounded-2xl" />
                </div>
            </div>
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
    const location = useLocation();

    return (
        <Suspense fallback={<LoadingScreen />}>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="h-full"
                >
                    <Routes location={location}>
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
                            path="/counseling"
                            element={
                                <PrivateRoute>
                                    <CounselingPage />
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
                </motion.div>
            </AnimatePresence>
        </Suspense>
    );
}
