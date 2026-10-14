import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, Link } from 'react-router-dom';
import { AppProvider, useApp, useProfile, useStore } from './data/AppContext';
import { IconChart, IconDrop, IconDumbbell, IconFood, IconHome, IconUser } from './ui/icons';
import { Loading } from './ui/components';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { Today } from './pages/Today';
import { Training } from './pages/Training';
import { Workout } from './pages/Workout';
import { Arms } from './pages/Arms';
import { Nutrition } from './pages/Nutrition';
import { Care } from './pages/Care';
import { Evolution } from './pages/Evolution';
import { ProfilePage } from './pages/ProfilePage';

function Shell() {
  const { profile, loading } = useProfile();
  const store = useStore();
  const [pending, setPending] = useState(0);
  useEffect(() => {
    document.documentElement.dataset.theme = profile?.preferences?.theme ?? 'dark';
  }, [profile?.preferences?.theme]);
  useEffect(() => {
    const tick = () => { void store.pendingCount().then(setPending); };
    tick();
    const t = setInterval(() => { void store.flush().then(tick); }, 15000);
    const off = store.subscribe(tick);
    return () => { clearInterval(t); off(); };
  }, [store]);

  if (loading) return <Loading />;
  if (!profile?.onboarding_completed_at) {
    return <Routes><Route path="*" element={<main className="main"><Onboarding /></main>} /></Routes>;
  }
  const nav = [
    { to: '/', label: 'Hoje', icon: <IconHome /> },
    { to: '/treino', label: 'Treino', icon: <IconDumbbell /> },
    { to: '/nutricao', label: 'Nutrição', icon: <IconFood /> },
    { to: '/cuidados', label: 'Cuidados', icon: <IconDrop /> },
    { to: '/evolucao', label: 'Evolução', icon: <IconChart /> },
  ];
  return (
    <div className="app">
      <nav className="nav" aria-label="Navegação principal">
        {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}>{n.icon}<span>{n.label}</span></NavLink>)}
      </nav>
      <main className="main">
        <div className="topbar">
          <span className="brand">TITAN</span>
          <Link to="/perfil" className="btn ghost sm" aria-label="Perfil e configurações"><IconUser /></Link>
        </div>
        {store.mode === 'local' && (
          <div className="banner">Modo local: os dados ficam só neste navegador. Para sincronizar entre aparelhos, configure a nuvem (veja Perfil → Sobre os dados).</div>
        )}
        {pending > 0 && <div className="banner info" role="status">{pending} registro(s) aguardando conexão para sincronizar — estão salvos neste aparelho.</div>}
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/treino" element={<Training />} />
          <Route path="/treino/sessao/:id" element={<Workout />} />
          <Route path="/treino/bracos" element={<Arms />} />
          <Route path="/nutricao" element={<Nutrition />} />
          <Route path="/cuidados" element={<Care />} />
          <Route path="/evolucao" element={<Evolution />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const { ready, store } = useApp();
  if (!ready) return <Loading label="Abrindo o Titan…" />;
  if (!store) return <Login />;
  return <Shell key={store.userId} />;
}

export function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AppProvider>
  );
}
