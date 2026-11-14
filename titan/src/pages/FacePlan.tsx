import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { todayISO } from '../domain/dates';
import { FACE_CLEAN, FACE_FAT_PLAN, FACE_PUFFINESS, FACE_ROUTINE, FACE_SKIP, FACE_SYMMETRY, FACE_TRUTH } from '../domain/facePlan';
import type { CheckinRow, MetricRow, TargetRow } from '../domain/types';
import { Card, fmt, useToast } from '../ui/components';

const EVIDENCE_LABEL = { boa: 'evidência boa', limitada: 'evidência limitada', 'postura/aparência': 'postura' } as const;

/** Plano do rosto: gordura facial (via corpo), treino facial diário, simetria percebida e pele limpa. */
export function FacePlan() {
  const store = useStore();
  const { profile } = useProfile();
  const today = todayISO();
  const checkins = useRows<CheckinRow>('daily_checkins', { eq: { date: today } });
  const metrics = useRows<MetricRow>('body_metrics', { order: { col: 'date', asc: false } });
  const targets = useRows<TargetRow>('nutrition_targets', { order: { col: 'effective_from', asc: false } });
  const { toast, node } = useToast();
  const checkin = checkins.data[0];
  const doneToday = !!checkin?.habits?.posture;
  const target = [...targets.data].sort((a, b) => (a.effective_from + (a.created_at ?? '') < b.effective_from + (b.created_at ?? '') ? 1 : -1))[0];
  const phase = (target?.inputs as { phase?: string } | undefined)?.phase;
  const waists = metrics.data.filter((m) => m.waist_cm !== null);
  const waistNow = waists[0] ? Number(waists[0].waist_cm) : null;
  const waistFirst = waists.length > 1 ? Number(waists[waists.length - 1].waist_cm) : null;

  async function markRoutine(value: boolean) {
    await store.upsert('daily_checkins', {
      ...(checkin ?? { id: uuid(), date: today, sleep_hours: null, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null }),
      habits: { ...(checkin?.habits ?? {}), posture: value },
    } as unknown as Record<string, unknown>);
    toast(value ? 'Treino facial de hoje marcado.' : 'Desmarcado.');
  }

  return (
    <div className="stack">
      {node}
      <Card title="Antes de tudo: o que é verdade" className="accent">
        <ul>{FACE_TRUTH.map((t) => <li key={t}><small>{t}</small></li>)}</ul>
      </Card>

      <Card title="1. Perder gordura do rosto" action={<span className={`tag ${phase === 'recomp' ? 'ok' : 'warn'}`}>{phase === 'recomp' ? 'recomposição ativa' : 'recomposição desligada'}</span>}>
        <ol className="list">
          {FACE_FAT_PLAN.map((f) => <li key={f.title}><strong>{f.title}</strong>{f.to && <> · <Link to={f.to}>abrir</Link></>}<br /><small className="muted">{f.detail}</small></li>)}
        </ol>
        <p className="hint">Cintura hoje: {waistNow !== null ? `${fmt(waistNow)} cm` : 'sem medida'}{waistFirst !== null && waistNow !== null ? ` (${waistNow - waistFirst >= 0 ? '+' : ''}${fmt(waistNow - waistFirst)} cm desde a primeira medição)` : ''}. {profile?.nutrition.weightKg ? '' : 'Informe o peso no Perfil para calcular a meta.'}</p>
        <p><strong>Inchaço não é gordura</strong> (some em dias):</p>
        <ul>{FACE_PUFFINESS.map((p) => <li key={p}><small>{p}</small></li>)}</ul>
      </Card>

      <Card title="2. Treino facial (5–6 min por dia)" action={<span className={`tag ${doneToday ? 'ok' : ''}`}>{doneToday ? 'feito hoje' : 'pendente'}</span>}>
        <p className="hint" style={{ marginTop: 0 }}>Postura, pescoço e drenagem: é o que muda o contorno do rosto sem depender de mito. Faça de manhã, depois de lavar o rosto.</p>
        <ul className="list">
          {FACE_ROUTINE.map((s) => (
            <li key={s.title}>
              <div className="row between"><strong>{s.title}</strong><span className="tag">{EVIDENCE_LABEL[s.evidence]}</span></div>
              <small>{s.how}</small><br />
              <small><strong>{s.dose}</strong></small>
              {s.caution && <><br /><small className="muted">{s.caution}</small></>}
            </li>
          ))}
        </ul>
        <button className={`btn ${doneToday ? '' : 'primary'} big`} style={{ marginTop: 10 }} onClick={() => void markRoutine(!doneToday)}>{doneToday ? 'Feito hoje ✓ (desmarcar)' : 'Marcar treino facial de hoje'}</button>
        <p className="hint">Conta na Missão do dia. Dor, tontura ou formigamento: pare e procure um profissional.</p>
      </Card>

      <Card title="O que NÃO fazer (e por quê)">
        <ul className="list">{FACE_SKIP.map((s) => <li key={s.what}><strong>{s.what}</strong><br /><small className="muted">{s.why}</small></li>)}</ul>
      </Card>

      <Card title="3. Rosto mais simétrico (o que dá para mudar)">
        <ul className="list">{FACE_SYMMETRY.map((s) => <li key={s.title}><strong>{s.title}</strong><br /><small className="muted">{s.detail}</small></li>)}</ul>
      </Card>

      <Card title="4. Rosto limpo" action={<Link className="btn sm" to="/cuidados">Rotina de pele</Link>}>
        <ul>{FACE_CLEAN.map((c) => <li key={c}><small>{c}</small></li>)}</ul>
      </Card>
    </div>
  );
}
