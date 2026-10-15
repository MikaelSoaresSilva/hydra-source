import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useProfile, useStore } from '../data/AppContext';
import { ACTIVITY_LABEL } from '../domain/nutrition';
import type { Profile } from '../domain/types';
import { createTargets, downloadJSON, profileReadyForTargets } from '../services';
import { Card, ErrorBox, Field, Loading, NumberInput, useToast } from '../ui/components';
import { apiKeyStore } from '../appearanceClient';

export function ProfilePage() {
  const store = useStore();
  const { email, signOut } = useApp();
  const { profile, save, loading } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const { toast, node } = useToast();
  if (loading || !profile) return <Loading />;
  const p = draft ?? profile;
  const set = (x: Partial<Profile>) => setDraft({ ...p, ...x });

  return (
    <div className="stack">
      {node}
      <h1>Perfil</h1>
      <Card title="Conta">
        <p>{store.mode === 'cloud' ? <>Conectado como <strong>{email}</strong>. Dados sincronizados na nuvem (Supabase), protegidos por Row Level Security.</> : <>Modo local — dados apenas neste navegador.</>}</p>
        <button className="btn" onClick={() => void signOut()}>Sair</button>
      </Card>

      <Card title="Dados básicos">
        <div className="grid two">
          <Field label="Nome"><input value={p.display_name ?? ''} onChange={(e) => set({ display_name: e.target.value })} /></Field>
          <Field label="Idade"><NumberInput value={p.age} min={13} max={100} onChange={(v) => set({ age: v === null ? null : Math.round(v) })} /></Field>
          <Field label="Altura (cm)"><NumberInput value={p.height_cm} min={120} max={230} onChange={(v) => set({ height_cm: v })} /></Field>
          <Field label="Peso de referência (kg)"><NumberInput value={p.nutrition.weightKg} min={30} max={300} onChange={(v) => set({ nutrition: { ...p.nutrition, weightKg: v ?? undefined } })} /></Field>
          <Field label="Sexo"><select value={p.sex ?? ''} onChange={(e) => set({ sex: (e.target.value || null) as Profile['sex'] })}><option value="">—</option><option value="male">Masculino</option><option value="female">Feminino</option></select></Field>
          <Field label="Atividade"><select value={p.nutrition.activityLevel ?? 'moderate'} onChange={(e) => set({ nutrition: { ...p.nutrition, activityLevel: e.target.value as 'moderate' } })}>{Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <ErrorBox error={error} />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" disabled={!draft} onClick={async () => {
            try { await save(p); setDraft(null); toast('Perfil salvo.'); } catch (e) { setError((e as Error).message); }
          }}>Salvar</button>
          <button className="btn" disabled={profileReadyForTargets(p).length > 0} onClick={async () => { await save(p); await createTargets(store, p); toast('Meta nutricional recalculada.'); }}>Salvar e recalcular meta</button>
        </div>
        <p className="hint">Para revisar treino, equipamentos, pele e cabelo em detalhe, <Link to="/onboarding">refaça o questionário</Link> (seus registros são mantidos).</p>
      </Card>

      <Card title="Aparência">
        <div className="row">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button key={t} className={`chip ${(p.preferences.theme ?? 'dark') === t ? 'on' : ''}`} aria-pressed={(p.preferences.theme ?? 'dark') === t}
              onClick={() => void save({ preferences: { ...p.preferences, theme: t } })}>{t === 'dark' ? 'Escuro' : t === 'light' ? 'Claro' : 'Do sistema'}</button>
          ))}
        </div>
      </Card>

      <Card title="Integração de IA (análise de aparência)">
        <label className="check"><input type="checkbox" checked={!!p.preferences.aiAppearance} onChange={(e) => void save({ preferences: { ...p.preferences, aiAppearance: e.target.checked } })} /> Permitir análise de fotos por IA (Claude, da Anthropic)</label>
        <p className="hint">Desligada, o app nunca envia fotos para IA. A chave da API, se você usar a sua, fica só neste aparelho.</p>
        {apiKeyStore.get() && <button className="btn ghost sm" onClick={() => { apiKeyStore.clear(); toast('Chave removida deste aparelho.'); }}>Remover chave da API deste aparelho</button>}
      </Card>

      <Card title="Sobre os dados e privacidade">
        <ul className="list">
          <li><small>Por padrão, nenhum dado é enviado a serviços de IA. A única integração de IA é a análise de aparência por foto: só funciona se você ligar abaixo e confirmar cada envio.</small></li>
          <li><small>Fotos ficam em bucket privado; links de visualização expiram em 1 hora.</small></li>
          <li><small>Sem conexão, os registros ficam numa fila no aparelho e são enviados quando a internet voltar.</small></li>
          <li><small>Preços, rótulos e medidas só existem se você os registrar — o app não inventa valores.</small></li>
        </ul>
      </Card>

      <Card title="Exportar dados">
        <p className="hint">Baixa um arquivo JSON com todos os seus registros (sem as imagens, que podem ser baixadas pela galeria).</p>
        <button className="btn" onClick={async () => downloadJSON(await store.exportAll(), `titan-export-${new Date().toISOString().slice(0, 10)}.json`)}>Exportar JSON</button>
      </Card>

      <Card title="Excluir conta e dados">
        <p className="hint">Apaga definitivamente perfil, treinos, medidas, fotos e {store.mode === 'cloud' ? 'a conta' : 'os dados locais'}. Não pode ser desfeito. Digite EXCLUIR para confirmar.</p>
        <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Confirmação de exclusão" />
        <button className="btn danger" style={{ marginTop: 8 }} disabled={confirmText !== 'EXCLUIR'} onClick={async () => {
          try { await store.deleteEverything(); await signOut(); } catch (e) { setError((e as Error).message); }
        }}>Excluir tudo</button>
      </Card>
    </div>
  );
}
