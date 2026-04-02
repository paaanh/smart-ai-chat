/**
 * App.jsx — Root component (NO BrowserRouter here — it's in main.jsx).
 *
 * Component tree:
 *   ErrorBoundary → SocketProvider → CallProvider → GlobalCallOverlay → AppRoutes
 *
 * SocketProvider & CallProvider only activate when authenticated
 * (they check token/user internally), so they safely wrap public routes too.
 *
 * CallModal + IncomingCallModal are rendered here (globally) so they appear
 * on top of ALL pages, not just ChatPage.
 */
import { SocketProvider } from './contexts/SocketContext';
import { CallProvider } from './contexts/CallContext';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';
import { useEffect, useState } from 'react';
import OnboardingPopup from './components/OnboardingPopup';
import ToastViewport from './components/ui/ToastViewport';
import CallModal from './components/call/CallModal';
import IncomingCallModal from './components/call/IncomingCallModal';
import NotificationPermission from './components/call/NotificationPermission';

export default function App() {
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (loading || !user?._id) return;

    // Mỗi tài khoản chỉ hiển thị một lần
    const onboardingKey = `onboarding_shown_${user._id}`;
    if (!localStorage.getItem(onboardingKey)) {
      setShowOnboarding(true);
    }
  }, [loading, user?._id]);

  const handleCloseOnboarding = () => {
    const onboardingKey = user?._id ? `onboarding_shown_${user._id}` : 'onboarding_shown';
    setShowOnboarding(false);
    localStorage.setItem(onboardingKey, '1');
  };

  return (
    <ErrorBoundary>
      <SocketProvider>
        <CallProvider>
          <ToastViewport />
          {showOnboarding && <OnboardingPopup onClose={handleCloseOnboarding} />}
          <AppRoutes />
          {/* Global call overlays — always on top of everything */}
          <CallModal />
          <IncomingCallModal />
          <NotificationPermission />
        </CallProvider>
      </SocketProvider>
    </ErrorBoundary>
  );
}
