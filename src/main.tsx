import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Global resilience: gracefully intercept unhandled rejections to prevent cross-origin script errors
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Portal caught unhandled rejection:', event.reason);
  });

  window.addEventListener('error', (event) => {
    console.warn('Portal caught global error:', event.message);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary
      fallbackTitle="Portal Recovery"
      fallbackMessage="A temporary error occurred while rendering the portal. Please click below to reload."
    >
      <App />
    </ErrorBoundary>
  </StrictMode>
);
