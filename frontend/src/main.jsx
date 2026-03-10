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
  if (!window.process || !window.process.nextTick) {
    window.process = Object.assign({}, window.process, {
      env: {},
      nextTick: function (fn) { setTimeout(fn, 0); },
    });
  }
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ''}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
