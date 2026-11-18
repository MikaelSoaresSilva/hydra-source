import { render } from 'preact';
import { App as CapApp } from '@capacitor/app';
import { App } from './app';
import { loadState, getState, isNative, flush } from './engine/store';
import { syncReminders, onNotificationTap } from './engine/notifications';
import './styles.css';

async function boot() {
  await loadState();
  render(<App />, document.getElementById('root')!);

  if (isNative()) {
    // Reagenda os lembretes a cada abertura (idempotente: IDs fixos, sem duplicar).
    const s = getState();
    if (s.onboarded) syncReminders(s.reminders.slots, s.reminders.enabled).catch(() => {});
    onNotificationTap((route) => { location.hash = route.replace(/^#/, ''); });
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const h = location.hash.slice(1) || '/hoje';
      if (h !== '/hoje' && canGoBack) history.back();
      else if (h !== '/hoje') location.hash = '/hoje';
      else CapApp.exitApp();
    });
    CapApp.addListener('pause', () => { flush(); });
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}

boot();
