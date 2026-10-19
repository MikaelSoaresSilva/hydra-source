import { useState } from 'react';
import { useGame, listBackups, writeNow } from '../store/game';
import { Panel } from './components';
import { migrate, validateBackup } from '../core/save';
import { newGame } from '../core/engine';
import { requestNotificationPermission, scheduleNotifications } from '../services/notifications';
import { deleteCloudAccount, signIn, signUp, syncNow } from '../services/cloud';
import { configureAudio, sfx } from '../services/audio';
import { Capacitor } from '@capacitor/core';

export function SettingsScreen() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const replace = useGame((x) => x.replace);
  const st = s.settings;
  const [msg, setMsg] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (fn: (d: typeof s) => void) => act((d) => fn(d));

  const exportData = async () => {
    const json = JSON.stringify(s, null, 2);
    const name = `life-leveling-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (Capacitor.isNativePlatform() && nav.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Backup Life Leveling' }); setMsg('Backup compartilhado.'); return; } catch { /* cancelado */ }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setMsg(Capacitor.isNativePlatform() ? 'Se o download não iniciar, copie o backup abaixo.' : 'Backup baixado.');
  };

  const importData = (f?: File) => {
    if (!f) return;
    f.text().then((t) => {
      try {
        const raw = JSON.parse(t);
        const err = validateBackup(raw);
        if (err) { setMsg(err); return; }
        if (!confirm('Substituir o progresso atual pelo backup? (Uma cópia do estado atual será guardada nos backups automáticos.)')) return;
        writeNow(s);
        replace(migrate(raw));
        setMsg('Backup restaurado.');
      } catch { setMsg('Arquivo inválido.'); }
    });
  };

  const cloud = async (kind: 'up' | 'in' | 'sync') => {
    setBusy(true); setMsg('');
    const c = s.settings.cloud;
    if (kind === 'sync') {
      const r = await syncNow(s);
      if (r.ok) { replace({ ...r.value.merged, settings: { ...r.value.merged.settings, cloud: { ...c, ...r.value.tokens } } }); setMsg('Sincronizado com a nuvem.'); }
      else setMsg(r.error);
    } else {
      const r = kind === 'up' ? await signUp(c, c.email, pass) : await signIn(c, c.email, pass);
      if (r.ok) { act((d) => { d.settings.cloud = { ...d.settings.cloud, ...r.value }; }); setMsg(r.value.accessToken ? 'Conectado. Toque em Sincronizar agora.' : 'Conta criada. Confirme o e-mail e depois entre.'); setPass(''); }
      else setMsg(r.error);
    }
    setBusy(false);
  };

  return (
    <div className="screen-inner">
      <h1>Configurações</h1>
      {msg && <div className="demo-banner" role="status">{msg}</div>}
      <Panel title="Gráficos e acessibilidade">
        <label className="field">Qualidade gráfica
          <select value={st.graphics} onChange={(e) => set((d) => { d.settings.graphics = e.target.value as never; })}>
            <option value="alto">Alta (sombras, mais partículas)</option><option value="medio">Média (recomendado)</option><option value="baixo">Baixa / economia de bateria</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={st.reducedMotion} onChange={(e) => set((d) => { d.settings.reducedMotion = e.target.checked; })} /> Reduzir movimento (cinemáticas curtas)</label>
      </Panel>
      <Panel title="Som">
        <label className="check"><input type="checkbox" checked={st.sound} onChange={(e) => { set((d) => { d.settings.sound = e.target.checked; }); configureAudio({ ...st, sound: e.target.checked }); }} /> Efeitos sonoros</label>
        <label className="check"><input type="checkbox" checked={st.music} onChange={(e) => { set((d) => { d.settings.music = e.target.checked; }); configureAudio({ ...st, music: e.target.checked }); }} /> Música ambiente</label>
        <label className="field">Volume<input type="range" min={0} max={1} step={0.05} value={st.volume} onChange={(e) => { set((d) => { d.settings.volume = Number(e.target.value); }); configureAudio({ ...st, volume: Number(e.target.value) }); }} onMouseUp={() => sfx('complete')} /></label>
      </Panel>
      <Panel title="Rotina e missões">
        <label className="field">Capacidade diária (missões antes de reorganizar): {st.dailyCapacity}<input type="range" min={1} max={12} value={st.dailyCapacity} onChange={(e) => set((d) => { d.settings.dailyCapacity = Number(e.target.value); })} /></label>
        <label className="check"><input type="checkbox" checked={st.surprise} onChange={(e) => set((d) => { d.settings.surprise = e.target.checked; })} /> Missões surpresa (máx. 1 por dia, opcionais, fora do horário de silêncio)</label>
      </Panel>
      <Panel title="Notificações">
        <label className="check"><input type="checkbox" checked={st.notifications.enabled} onChange={async (e) => {
          const on = e.target.checked;
          if (on && !(await requestNotificationPermission())) { setMsg('Permissão negada. Ative em Configurações do Android → Apps → Life Leveling → Notificações.'); return; }
          act((d) => { d.settings.notifications.enabled = on; });
          setMsg(await scheduleNotifications({ ...s, settings: { ...st, notifications: { ...st.notifications, enabled: on } } }));
        }} /> Ativar lembretes do SISTEMA</label>
        <div className="row gap wrap">
          {([['digestTime', 'Resumo diário'], ['studyTime', 'Sessão de estudo'], ['quietStart', 'Silêncio a partir de'], ['quietEnd', 'Silêncio até']] as const).map(([k, l]) => (
            <label key={k} className="field" style={{ width: 150 }}>{l}<input type="time" value={st.notifications[k]} onChange={(e) => set((d) => { d.settings.notifications[k] = e.target.value; })} /></label>
          ))}
        </div>
        {(['missoes', 'estudo', 'conquistas', 'campanhas'] as const).map((k) => <label key={k} className="check"><input type="checkbox" checked={st.notifications.categories[k]} onChange={(e) => set((d) => { d.settings.notifications.categories[k] = e.target.checked; })} /> {{ missoes: 'Missões do dia', estudo: 'Estudo programado', conquistas: 'Conquistas', campanhas: 'Campanhas e chefes' }[k]}</label>)}
        <button className="btn small" onClick={async () => setMsg(await scheduleNotifications(useGame.getState().s))}>Aplicar horários</button>
        <p className="small muted" style={{ marginTop: 8 }}>No Android, lembretes são agendados no próprio aparelho (funcionam offline). Alguns fabricantes (Xiaomi, Samsung etc.) podem atrasar notificações por economia de bateria: libere o app em “Bateria → Sem restrições” se necessário. No máximo 3 lembretes/dia, nunca no horário de silêncio.</p>
      </Panel>
      <Panel title="IA do SISTEMA (opcional)">
        <p className="small muted">Sem IA, o SISTEMA funciona offline com regras próprias. Com IA, você usa sua própria chave da API da Anthropic (Claude). A chave fica <b>somente neste aparelho</b>, nunca no código nem na nuvem. Custos de uso são cobrados pela Anthropic na sua conta.</p>
        <label className="check"><input type="checkbox" checked={st.ai.enabled} onChange={(e) => set((d) => { d.settings.ai.enabled = e.target.checked; })} /> Ativar IA</label>
        <label className="field">Chave da API<input type="password" value={st.ai.apiKey} onChange={(e) => set((d) => { d.settings.ai.apiKey = e.target.value.trim(); })} placeholder="sk-ant-..." autoComplete="off" /></label>
        <div className="row gap">
          <label className="field grow">Modelo<select value={st.ai.model} onChange={(e) => set((d) => { d.settings.ai.model = e.target.value; })}><option value="claude-opus-5-5">Claude Opus 5.5 (padrão)</option><option value="claude-sonnet-5-5">Claude Sonnet 5.5</option><option value="claude-haiku-5-5">Claude Haiku 5.5 (mais barato)</option></select></label>
          <label className="field" style={{ width: 120 }}>Limite/dia<input type="number" min={1} max={500} value={st.ai.dailyLimit} onChange={(e) => set((d) => { d.settings.ai.dailyLimit = Math.max(1, Number(e.target.value) || 1); })} /></label>
        </div>
      </Panel>
      <Panel title="Conta na nuvem (opcional)">
        <p className="small muted">Por padrão, tudo fica salvo neste aparelho (funciona offline). Para recuperar o progresso em outro celular, conecte um projeto Supabase gratuito (instruções no README: arquivo <span className="mono">supabase/schema.sql</span>). Fotos e chaves nunca são enviadas.</p>
        <label className="field">URL do projeto<input type="url" value={st.cloud.url} onChange={(e) => set((d) => { d.settings.cloud.url = e.target.value.trim(); })} placeholder="https://xxxx.supabase.co" /></label>
        <label className="field">Chave pública (anon)<input type="password" value={st.cloud.anonKey} onChange={(e) => set((d) => { d.settings.cloud.anonKey = e.target.value.trim(); })} /></label>
        <label className="field">E-mail<input type="email" value={st.cloud.email} onChange={(e) => set((d) => { d.settings.cloud.email = e.target.value.trim(); })} /></label>
        {!st.cloud.userId && <label className="field">Senha<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>}
        <div className="row gap wrap">
          {!st.cloud.userId ? <>
            <button className="btn" disabled={busy || !pass} onClick={() => cloud('in')}>Entrar</button>
            <button className="btn ghost" disabled={busy || pass.length < 6} onClick={() => cloud('up')}>Criar conta</button>
          </> : <>
            <button className="btn primary" disabled={busy} onClick={() => cloud('sync')}>Sincronizar agora</button>
            <button className="btn ghost" onClick={() => act((d) => { d.settings.cloud = { ...d.settings.cloud, accessToken: undefined, refreshToken: undefined, userId: undefined }; })}>Sair</button>
            <button className="btn danger" onClick={async () => { if (!confirm('Excluir sua conta e o save da nuvem PERMANENTEMENTE? O progresso local continua no aparelho.')) return; const r = await deleteCloudAccount(st.cloud); setMsg(r.ok ? 'Conta da nuvem excluída.' : r.error); if (r.ok) act((d) => { d.settings.cloud = { ...d.settings.cloud, accessToken: undefined, refreshToken: undefined, userId: undefined }; }); }}>Excluir conta</button>
          </>}
        </div>
        <label className="check"><input type="checkbox" checked={st.cloud.auto} onChange={(e) => set((d) => { d.settings.cloud.auto = e.target.checked; })} /> Sincronizar automaticamente ao abrir o app</label>
        {st.cloud.lastSync && <p className="small muted">Última sincronização: {new Date(st.cloud.lastSync).toLocaleString('pt-BR')}</p>}
      </Panel>
      <Panel title="Seus dados">
        <div className="row gap wrap">
          <button className="btn" onClick={exportData}>Exportar backup (JSON)</button>
          <label className="btn">Importar backup<input type="file" accept="application/json,.json" hidden onChange={(e) => importData(e.target.files?.[0])} /></label>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Backups automáticos locais: {listBackups().map((b) => new Date(b.at).toLocaleDateString('pt-BR')).join(', ') || 'nenhum ainda'}.</p>
        {listBackups().length > 0 && <button className="btn small ghost" onClick={() => { const b = listBackups()[0]; if (confirm(`Restaurar backup automático de ${new Date(b.at).toLocaleString('pt-BR')}?`)) replace(migrate(JSON.parse(b.data))); }}>Restaurar backup automático mais recente</button>}
        <hr style={{ borderColor: 'var(--line)', margin: '14px 0' }} />
        <button className="btn small danger" onClick={() => act((d) => { delete d.character.appearance.photo; d.body.forEach((b) => delete b.photo); })}>Apagar todas as fotos</button>{' '}
        <button className="btn small danger" onClick={() => { if (confirm('APAGAR TODO o progresso deste aparelho? Exporte um backup antes. Isso não pode ser desfeito.') && confirm('Tem certeza absoluta?')) { writeNow(s); replace(newGame()); } }}>Apagar progresso local</button>
      </Panel>
      <p className="small muted center">LIFE LEVELING: AWAKENING · v0.1.0 · Permissões usadas: notificações (opcional), internet (somente para IA/nuvem, opcionais).</p>
    </div>
  );
}
