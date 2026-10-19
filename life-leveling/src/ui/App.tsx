import { Component, useEffect, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useGame, runDaily } from '../store/game';
import { Onboarding } from './Onboarding';
import { Home } from './Home';
import { MissionsScreen } from './Missions';
import { WorldScreen } from './World';
import { HeroScreen } from './Hero';
import { LifeScreen } from './Life';
import { SystemChat } from './SystemChat';
import { SettingsScreen } from './Settings';
import { Overlay } from './Overlay';
import { configureAudio, sfx, startMusic } from '../services/audio';
import { syncNow } from '../services/cloud';
import { scheduleNotifications } from '../services/notifications';
import { skillPoints, unlockedChapters } from '../core/engine';

export type Tab = 'inicio' | 'missoes' | 'mundo' | 'heroi' | 'vida' | 'sistema' | 'config';

const NAV: [Tab, string, string][] = [
  ['inicio', '◈', 'Início'], ['missoes', '◇', 'Missões'], ['mundo', '⬡', 'Mundo'], ['heroi', '♜', 'Herói'], ['vida', '✦', 'Vida'], ['sistema', '◉', 'Sistema'],
];

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="screen"><div className="screen-inner"><div className="panel">
        <h2>Algo deu errado nesta tela</h2>
        <p className="muted">Seu progresso está salvo no aparelho. Detalhe técnico: {this.state.error.message}</p>
        <button className="btn primary" onClick={() => { this.setState({ error: undefined }); }}>Tentar novamente</button>{' '}
        <button className="btn" onClick={() => location.reload()}>Recarregar app</button>
      </div></div></div>
    );
    return this.props.children;
  }
}

export function App() {
  const s = useGame((x) => x.s);
  const replace = useGame((x) => x.replace);
  const [tab, setTab] = useState<Tab>('inicio');

  useEffect(() => {
    configureAudio(s.settings);
    runDaily();
    const onFirst = () => { startMusic('calmo'); window.removeEventListener('pointerdown', onFirst); };
    window.addEventListener('pointerdown', onFirst);
    const subs: Promise<{ remove: () => void }>[] = [];
    if (Capacitor.isNativePlatform()) {
      subs.push(CapApp.addListener('resume', () => runDaily()));
      subs.push(CapApp.addListener('backButton', () => { if (document.querySelector('.modal-back')) return; setTab((t) => (t === 'inicio' ? (CapApp.minimizeApp(), t) : 'inicio')); }));
    }
    const st = useGame.getState().s;
    if (st.settings.cloud.auto && st.settings.cloud.userId) {
      syncNow(st).then((r) => { if (r.ok) replace({ ...r.value.merged, settings: { ...r.value.merged.settings, cloud: { ...st.settings.cloud, ...r.value.tokens } } }); });
    }
    if (st.settings.notifications.enabled) scheduleNotifications(st);
    return () => { subs.forEach((p) => p.then((x) => x.remove())); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', s.settings.reducedMotion); }, [s.settings.reducedMotion]);

  if (!s.onboarded) return <div className="app"><Onboarding /><Overlay /></div>;

  const go = (t: Tab) => { sfx('click'); setTab(t); document.querySelector('.screen')?.scrollTo({ top: 0 }); };
  const heroDot = skillPoints(s).free > 0;
  const worldDot = unlockedChapters(s).some((id) => !s.storySeen.includes(id));

  return (
    <div className="app">
      <main className="screen">
        <div className="row" style={{ justifyContent: 'flex-end', maxWidth: 760, margin: '0 auto 6px' }}>
          <span className="sys-head" style={{ marginRight: 'auto' }}>LIFE LEVELING</span>
          <button className="icon-btn" aria-label="Configurações" onClick={() => go('config')}>⚙</button>
        </div>
        <ErrorBoundary key={tab}>
          {tab === 'inicio' && <Home go={go} />}
          {tab === 'missoes' && <MissionsScreen />}
          {tab === 'mundo' && <WorldScreen />}
          {tab === 'heroi' && <HeroScreen />}
          {tab === 'vida' && <LifeScreen />}
          {tab === 'sistema' && <SystemChat />}
          {tab === 'config' && <SettingsScreen />}
        </ErrorBoundary>
      </main>
      <nav className="nav">
        {NAV.map(([t, ic, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)} aria-label={label}>
            <span className="ic">{ic}</span>{label}
            {((t === 'heroi' && heroDot) || (t === 'mundo' && worldDot)) && <i className="dot" />}
          </button>
        ))}
      </nav>
      <Overlay />
    </div>
  );
}
