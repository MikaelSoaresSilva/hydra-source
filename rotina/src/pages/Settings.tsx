import { useEffect, useRef, useState } from 'react';
import { apiKeyStore, looksLikeApiKey } from '../ai';
import { useApp } from '../data/AppContext';
import { native, openExactAlarmSettings, permissionInfo, plannedNotifications, requestPermission, testNotification, type PermissionInfo } from '../data/notify';
import { exportBackup, parseBackup } from '../data/store';
import { defaultState } from '../domain/defaults';
import type { Profile } from '../domain/types';
import { Card, Chips } from '../ui/components';

const PERM_LABEL = { granted: 'permitidas ✅', denied: 'bloqueadas ❌', prompt: 'ainda não permitidas', unsupported: 'não suportadas neste navegador' } as const;

export function Settings() {
  const { state, update, toast, now } = useApp();
  const [perm, setPerm] = useState<PermissionInfo | null>(null);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(!!apiKeyStore.get());
  const file = useRef<HTMLInputElement>(null);
  const s = state.settings;
  const setS = (patch: Partial<typeof s>) => update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));
  const setP = (patch: Partial<Profile>) => update((x) => ({ ...x, profile: { ...x.profile, ...patch } }));
  const pending = plannedNotifications(state, now).length;

  useEffect(() => { void permissionInfo().then(setPerm); }, []);
  useEffect(() => { document.documentElement.dataset.theme = s.theme; }, [s.theme]);

  return (
    <div className="stack">
      <div><span className="kicker">Configurações</span><h1>Ajustes</h1></div>

      <Card title="🔔 Notificações e alarmes">
        <p style={{ marginTop: 0 }}>Notificações: <strong data-testid="perm">{perm ? PERM_LABEL[perm.display] : '…'}</strong>
          {native() && perm && perm.exact !== 'unsupported' && <><br />Alarmes no horário exato: <strong>{perm.exact === 'granted' ? 'permitidos ✅' : 'desligados — os avisos podem atrasar alguns minutos'}</strong></>}</p>
        {!native() && <div className="banner" style={{ marginBottom: 8 }}>No navegador os avisos só aparecem com a página aberta. No app Android eles tocam com o app fechado e a tela bloqueada.</div>}
        <div className="row wrap">
          {perm?.display !== 'granted' && perm?.display !== 'unsupported' && <button className="btn primary sm" onClick={async () => setPerm(await requestPermission())}>Permitir notificações</button>}
          {native() && perm?.exact === 'denied' && <button className="btn sm" onClick={async () => { await openExactAlarmSettings(); setPerm(await permissionInfo()); }}>Permitir alarmes exatos</button>}
          <button className="btn sm" onClick={async () => toast((await testNotification()) ? '🔔 Teste em 5 segundos' : 'Permita as notificações primeiro')}>Testar notificação</button>
        </div>
        <div className="sep" />
        <div className="stack" style={{ gap: 10 }}>
          <label className="check"><input type="checkbox" checked={s.notifications} onChange={(e) => setS({ notifications: e.target.checked })} /> Lembretes no início de cada atividade (com a próxima atividade)</label>
          <label className="check"><input type="checkbox" checked={s.lateAlerts} onChange={(e) => setS({ lateAlerts: e.target.checked })} /> Avisar quando uma atividade estiver atrasada</label>
          <div className="grid2">
            <label className="field">Atrasada depois de (min)<input type="number" min={5} max={120} value={s.lateAfterMin} onChange={(e) => setS({ lateAfterMin: Math.max(5, Math.min(120, Number(e.target.value) || 15)) })} /></label>
            <label className="field">Adiar por (min)<input type="number" min={5} max={120} value={s.snoozeMin} onChange={(e) => setS({ snoozeMin: Math.max(5, Math.min(120, Number(e.target.value) || 10)) })} /></label>
          </div>
          <small className="muted">{pending} lembretes programados para hoje e os próximos 2 dias. Cada aviso tem os botões "Concluir" e "Adiar". O despertador usa um canal próprio de prioridade máxima.</small>
        </div>
      </Card>

      <Card title="🍽️ Metas de nutrição">
        <div className="grid2">
          <label className="field">Peso (kg)<input type="number" inputMode="decimal" value={state.profile.weightKg} onChange={(e) => setP({ weightKg: Number(e.target.value) || 0 })} /></label>
          <label className="field">Água (ml/dia)<input type="number" inputMode="numeric" value={state.profile.waterMl} onChange={(e) => setP({ waterMl: Number(e.target.value) || 2000 })} /></label>
          <label className="field">Calorias (kcal)<input type="number" inputMode="numeric" value={state.profile.kcal} onChange={(e) => setP({ kcal: Number(e.target.value) || 0 })} /></label>
          <label className="field">Proteína (g)<input type="number" inputMode="numeric" value={state.profile.protein} onChange={(e) => setP({ protein: Number(e.target.value) || 0 })} /></label>
          <label className="field">Carboidratos (g)<input type="number" inputMode="numeric" value={state.profile.carbs} onChange={(e) => setP({ carbs: Number(e.target.value) || 0 })} /></label>
          <label className="field">Gorduras (g)<input type="number" inputMode="numeric" value={state.profile.fat} onChange={(e) => setP({ fat: Number(e.target.value) || 0 })} /></label>
        </div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { setP({ waterMl: Math.round((state.profile.weightKg * 35) / 100) * 100 }); toast('💧 Água = 35 ml por kg'); }}>Calcular água pelo peso (35 ml/kg)</button>
        <p className="muted" style={{ marginBottom: 0 }}><small>Os valores iniciais vêm do seu plano no Titan (recomposição: ~2.450 kcal, 2 g/kg de proteína). Ajuste se mudar de fase.</small></p>
      </Card>

      <Card title="🤖 IA do Claude (opcional)">
        <p style={{ marginTop: 0 }}>O "Descreva sua necessidade" funciona <strong>sem internet</strong>, no próprio aparelho. Para pedidos que ele não entender, dá para usar o Claude com a <strong>sua</strong> chave da API.</p>
        <div className="banner warn" style={{ marginBottom: 8 }}>Ao usar o Claude, o seu pedido e a lista de atividades (nomes, horários, durações) são enviados à Anthropic. Nada de histórico, nome ou e-mail. A chave fica só neste aparelho e não entra no backup. Você sempre vê a prévia antes de aplicar.</div>
        <label className="check"><input type="checkbox" checked={s.aiEnabled} onChange={(e) => setS({ aiEnabled: e.target.checked })} /> Usar o Claude quando o app não entender</label>
        {s.aiEnabled && (
          <div className="stack" style={{ marginTop: 10 }}>
            {hasKey ? (
              <div className="row between"><span>Chave salva neste aparelho ✅</span><button className="btn danger sm" onClick={() => { apiKeyStore.clear(); setHasKey(false); toast('Chave apagada'); }}>Apagar chave</button></div>
            ) : (
              <>
                <label className="field">Chave da API (sk-ant-…)<input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} /></label>
                <button className="btn sm" disabled={!looksLikeApiKey(key)} onClick={() => { apiKeyStore.set(key); setKey(''); setHasKey(true); toast('🔐 Chave salva no aparelho'); }}>Salvar chave</button>
              </>
            )}
          </div>
        )}
      </Card>

      <Card title="💾 Backup">
        <p style={{ marginTop: 0 }}>Tudo fica salvo no aparelho e continua ao fechar o app. Faça backup de vez em quando para não perder nada ao trocar de celular.</p>
        <div className="row wrap">
          <button className="btn primary sm" onClick={async () => { const r = await exportBackup(state); toast(r === 'shared' ? 'Escolha onde salvar o backup' : '💾 Backup baixado'); }}>Fazer backup</button>
          <button className="btn sm" onClick={() => file.current?.click()}>Restaurar backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Arquivo de backup" onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const r = parseBackup(await f.text());
            if (!r.ok) { toast(`❌ ${r.error}`); return; }
            if (!confirm('Substituir os dados atuais pelos do backup?')) return;
            update(() => r.state);
            toast('✅ Backup restaurado');
          }} />
        </div>
        <div className="sep" />
        <button className="btn danger sm" onClick={() => {
          if (!confirm('Apagar TODOS os dados (rotina, XP, histórico) e começar do zero?')) return;
          update(() => defaultState());
          toast('Dados apagados');
        }}>Apagar todos os dados</button>
      </Card>

      <Card title="🎨 Aparência">
        <Chips label="Tema" value={s.theme} onChange={(v) => setS({ theme: v })} options={[{ value: 'dark', label: '🌙 Escuro' }, { value: 'light', label: '☀️ Claro' }]} />
      </Card>

      <p className="muted" style={{ textAlign: 'center' }}><small>Titan Rotina 1.3 · dados só no seu aparelho</small></p>
    </div>
  );
}
