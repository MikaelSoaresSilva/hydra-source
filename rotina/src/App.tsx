import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AppProvider, useApp } from './data/AppContext';
import { Assistant } from './pages/Assistant';
import { Evolution } from './pages/Evolution';
import { Routine } from './pages/Routine';
import { Settings } from './pages/Settings';
import { Today } from './pages/Today';

const TABS = [
  { id: 'hoje', label: 'Hoje', icon: '🏠' },
  { id: 'rotina', label: 'Rotina', icon: '🗓️' },
  { id: 'ia', label: 'IA', icon: '✨' },
  { id: 'evolucao', label: 'Evolução', icon: '🏆' },
  { id: 'ajustes', label: 'Ajustes', icon: '⚙️' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function Shell() {
  const { state } = useApp();
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'hoje');
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; }, [state.settings.theme]);
  useEffect(() => { history.replaceState(null, '', `#${tab}`); window.scrollTo({ top: 0 }); }, [tab]);
  // Botão "voltar" do Android: volta para Hoje antes de sair do app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = CapApp.addListener('backButton', () => { if (tab !== 'hoje') setTab('hoje'); else void CapApp.minimizeApp(); });
    return () => { void h.then((x) => x.remove()); };
  }, [tab]);
  return (
    <div className="app">
      <nav className="nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button key={t.id} className={`${tab === t.id ? 'active' : ''} ${t.id === 'ia' ? 'ai' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <span className="ic" aria-hidden>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        {tab === 'hoje' && <Today go={(t) => setTab(t as Tab)} />}
        {tab === 'rotina' && <Routine />}
        {tab === 'ia' && <Assistant />}
        {tab === 'evolucao' && <Evolution />}
        {tab === 'ajustes' && <Settings />}
      </main>
    </div>
  );
}

export function App() {
  return <AppProvider><Shell /></AppProvider>;
}
