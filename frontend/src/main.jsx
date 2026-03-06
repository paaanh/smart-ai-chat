/**
 * main.jsx — Application entry point.
 *
 * Provider order (outermost → innermost):
 *   StrictMode → AuthProvider → BrowserRouter → App
 *
 * AuthProvider wraps BrowserRouter so that:
 *   1. Auth state is available to ALL route-level components
 *   2. No circular dependency between routing and auth
 *   3. 401 logout events reset React state before navigation
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
