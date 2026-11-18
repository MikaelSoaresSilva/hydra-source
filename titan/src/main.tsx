import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './ui/styles.css';

// O service worker só existe no build web (no APK os arquivos já estão no aparelho).
if (import.meta.env.VITE_NATIVE !== '1') {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
