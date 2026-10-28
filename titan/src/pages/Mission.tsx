import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, todayISO, WEEKDAY_SHORT, weekday } from '../domain/dates';
import {
  BUDGET, DAY_PASS, FACE_PLAN, MISSION_WEEKS, PHASES, dayStatus, streak, weekScore, type HabitArea, type MissionData,
} from '../domain/mission';
import type { CareLogRow, CheckinRow, FoodLogRow, ProgramRow, RoutineItemRow, SessionRow, TargetRow } from '../domain/types';
import { Card, Loading, Progress, useToast } from '../ui/components';

const AREA_LABEL: Record<HabitArea, string> = { corpo: 'Corpo', rosto: 'Rosto', base: 'Base (sono, água, comida)' };

/** Dados da Missão a partir dos registros do app (últimos ~4 meses). */
export function useMissionData(): { data: MissionData; loading: boolean } {
  const today = todayISO();
  const since = addDays(today, -125);
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const food = useRows<FoodLogRow>('food_logs', { gte: { date: since } });
  const targets = useRows<TargetRow>('nutrition_targets', { order: { col: 'effective_from', asc: false } });
  const care = useRows<CareLogRow>('care_logs', { gte: { date: since } });
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: since } });
  const routine = useRows<RoutineItemRow>('routine_items');
  const data = useMemo<MissionData>(() => ({
    program: programs.data[0] ?? null,
    sessions: sessions.data,
    foodLogs: food.data,
    target: [...targets.data].sort((a, b) => (a.effective_from + (a.created_at ?? '') < b.effective_from + (b.created_at ?? '') ? 1 : -1))[0] ?? null,
    careLogs: care.data,
    checkins: checkins.data,
    hasSkinRoutine: routine.data.some((r) => r.area === 'skin' && r.enabled),
  }), [programs.data, sessions.data, food.data, targets.data, care.data, checkins.data, routine.data]);
  return { data, loading: programs.loading || sessions.loading || checkins.loading };
}

export function Mission() {
  const store = useStore();
  const { profile, save } = useProfile();
  const { data, loading } = useMissionData();
  const { toast, node } = useToast();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const today = todayISO();
  if (loading || !profile) return <Loading />;

  const start = profile.preferences.missionStart ?? null;
  const week = start ? Math.min(MISSION_WEEKS, Math.floor((Date.parse(today) - Date.parse(start)) / (7 * 86400000)) + 1) : 0;
  const phase = PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) ?? PHASES[0];
  const withLocal: MissionData = Object.keys(optimistic).length ? {
    ...data,
    checkins: [...data.checkins.filter((c) => c.date !== today), { ...(data.checkins.find((c) => c.date === today) ?? { date: today }), habits: { ...(data.checkins.find((c) => c.date === today)?.habits ?? {}), ...optimistic } } as CheckinRow],
  } : data;
  const st = dayStatus(withLocal, today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const checkin = data.checkins.find((c) => c.date === today);

  async function toggle(id: string, value: boolean) {
    setOptimistic((o) => ({ ...o, [id]: value }));
    await store.upsert('daily_checkins', {
      ...(checkin ?? { id: uuid(), date: today, sleep_hours: null, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null }),
      habits: { ...(checkin?.habits ?? {}), ...optimistic, [id]: value },
    } as unknown as Record<string, unknown>);
  }

  if (!start) {
    return (
      <div className="stack">
        <h1>Missão Titan</h1>
        <Card title="12 semanas, o máximo de resultado com o mínimo de gasto" className="accent">
          <p>O plano junta o que o Titan já sabe fazer, no ritmo mais rápido que ainda é sustentável:</p>
          <ul>
            <li><small><strong>Corpo:</strong> Protocolo JKK, progressão série a série e proteína todo dia.</small></li>
            <li><small><strong>Rosto:</strong> corte certo para o formato do rosto, pele em 3 passos, barba e sobrancelha alinhadas, postura e dentes.</small></li>
            <li><small><strong>Base:</strong> sono, água e comida feita em casa, que é o jeito mais barato.</small></li>
          </ul>
          <p className="hint">Não existe atalho seguro que faça isso em dias: músculo cresce em semanas e meses. O que dá para acelerar é a consistência — e é isso que a Missão mede, todo dia.</p>
          <button className="btn primary big" onClick={async () => { await save({ preferences: { ...profile.preferences, missionStart: today } }); toast('Missão iniciada. Bora!'); }}>Começar hoje</button>
        </Card>
        {node}
      </div>
    );
  }

  const areas: HabitArea[] = ['corpo', 'rosto', 'base'];
  const s = streak(withLocal, today);
  return (
    <div className="stack">
      {node}
      <div>
        <h1>Missão Titan</h1>
        <p className="muted">Semana {week} de {MISSION_WEEKS} · {phase.title} · início {formatBR(start)}</p>
      </div>

      <div className="grid two">
        <Card title="Hoje">
          <p style={{ fontSize: '1.6rem', margin: 0 }}><strong>{st.done}/{st.total}</strong></p>
          <Progress value={st.done} max={Math.max(1, st.total)} label="Missão de hoje" />
          <p className="hint">{st.score >= DAY_PASS ? '✅ Dia cumprido (≥ 80%).' : `Faltam ${Math.max(0, Math.ceil(st.total * DAY_PASS) - st.done)} item(ns) para cumprir o dia.`}</p>
        </Card>
        <Card title="Ritmo">
          <p style={{ margin: 0 }}>🔥 Sequência: <strong>{s} dia(s)</strong></p>
          <p style={{ margin: '6px 0 0' }}>Nota dos últimos 7 dias: <strong>{weekScore(withLocal, today)}</strong>/100</p>
          <div className="week" style={{ marginTop: 8 }}>
            {days.map((d) => {
              const sc = dayStatus(withLocal, d).score;
              return <div key={d} className={`d ${d === today ? 'today' : ''}`} title={`${Math.round(sc * 100)}%`}>{WEEKDAY_SHORT[weekday(d)]}<br /><span className={`dot ${sc >= DAY_PASS ? 'done' : sc > 0 ? 'train' : ''}`} /></div>;
            })}
          </div>
        </Card>
      </div>

      {areas.map((a) => (
        <Card key={a} title={AREA_LABEL[a]}>
          <ul className="list">
            {st.items.filter((i) => i.habit.area === a).map(({ habit, done }) => (
              <li key={habit.id} className="row between">
                <span style={{ flex: 1 }}>
                  {habit.auto ? (done === null ? '➖' : done ? '✅' : '⏳') : (
                    <input type="checkbox" aria-label={habit.label} checked={!!done} onChange={(e) => void toggle(habit.id, e.target.checked)} style={{ width: 20, height: 20, verticalAlign: 'middle' }} />
                  )} <strong>{habit.label}</strong>
                  <br /><small className="muted">{done === null ? 'Não se aplica hoje. ' : ''}{habit.why}</small>
                </span>
                {habit.auto && habit.to && done === false && <Link className="btn sm" to={habit.to}>Fazer</Link>}
              </li>
            ))}
          </ul>
          {a === 'rosto' && !data.hasSkinRoutine && <p className="hint">Os itens de pele só contam depois que você gerar a rotina em <Link to="/cuidados">Cuidados</Link>.</p>}
        </Card>
      ))}
      <p className="hint">Itens com ✅/⏳ são marcados sozinhos pelo que você registra (treino, comida, check-in, rotina de pele). Os com caixinha você marca aqui.</p>

      <Card title={`Fase atual: ${phase.title} (semanas ${phase.weeks[0]}–${phase.weeks[1]})`} className="accent">
        <p><strong>Foco</strong></p>
        <ul>{phase.focus.map((f) => <li key={f}><small>{f}</small></li>)}</ul>
        <p><strong>O que é realista esperar</strong></p>
        <ul>{phase.expect.map((f) => <li key={f}><small>{f}</small></li>)}</ul>
        <details><summary>Todas as fases</summary>
          {PHASES.map((p) => <p key={p.title}><small><strong>Semanas {p.weeks[0]}–{p.weeks[1]} · {p.title}:</strong> {p.focus.join('; ')}.</small></p>)}
        </details>
      </Card>

      <Card title="Plano do rosto">
        <ol className="list">
          {FACE_PLAN.map((f) => <li key={f.title}><strong>{f.title}</strong>{f.to && <> · <Link to={f.to}>abrir</Link></>}<br /><small className="muted">{f.detail}</small></li>)}
        </ol>
      </Card>

      <Card title="Gastando pouco">
        <p><strong>Essencial</strong></p><ul>{BUDGET.essential.map((x) => <li key={x}><small>{x}</small></li>)}</ul>
        <p><strong>Opcional</strong></p><ul>{BUDGET.optional.map((x) => <li key={x}><small>{x}</small></li>)}</ul>
        <p><strong>Não gaste com</strong></p><ul>{BUDGET.skip.map((x) => <li key={x}><small>{x}</small></li>)}</ul>
        <p className="hint">Registre os preços que você paga em Nutrição → Compras: o app calcula o custo do mês só com preços reais seus.</p>
      </Card>

      <button className="btn ghost sm" onClick={async () => { if (confirm('Reiniciar a Missão a partir de hoje? Os registros continuam.')) await save({ preferences: { ...profile.preferences, missionStart: today } }); }}>Reiniciar contagem das 12 semanas</button>
    </div>
  );
}
