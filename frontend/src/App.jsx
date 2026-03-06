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
import ErrorBoundary from './components/ErrorBoundary';
import AppRoutes from './routes/AppRoutes';
import CallModal from './components/call/CallModal';
import IncomingCallModal from './components/call/IncomingCallModal';
import NotificationPermission from './components/call/NotificationPermission';

export default function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <CallProvider>
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
