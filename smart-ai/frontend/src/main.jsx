/**
 * main.jsx — Application entry point.
 *
 * Provider order (outermost → innermost):
 *   StrictMode → GoogleOAuthProvider → ThemeProvider → AuthProvider → CallProvider → BrowserRouter → App
 *
 * AuthProvider wraps BrowserRouter so that:
 *   1. Auth state is available to ALL route-level components
 *   2. No circular dependency between routing and auth
 *   3. 401 logout events reset React state before navigation
 *
 * CallProvider sits inside AuthProvider (needs useAuth + useSocket).
 */
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  if (!window.global) {
    window.global = window;
  }
  if (!window.process || !window.process.nextTick) {
    window.process = Object.assign({}, window.process, {
      env: {},
      nextTick: function (fn) { setTimeout(fn, 0); },
    });
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('[PWA] Service worker registration failed:', error);
    });
  });
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function AppProviders() {
  const app = (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );

  if (!GOOGLE_CLIENT_ID) {
    return app;
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {app}
    </GoogleOAuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);
