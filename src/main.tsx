import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  if ('serviceWorker' in navigator) {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (!isIframe) {
      window.addEventListener('load', () => {
        try {
          navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('KonnectS Service Worker registered in container scope:', reg.scope))
            .catch(err => console.warn('Service Worker installation blocked or skipped:', err));
        } catch (err) {
          console.warn('Service Worker registration failed synchronously:', err);
        }
      });
    } else {
      console.log('Service Worker registration skipped in iframe sandbox environment.');
    }
  }
} catch (e) {
  console.warn('Service Worker registration disabled in sandboxed environment:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
