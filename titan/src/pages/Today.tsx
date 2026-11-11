import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, todayISO, WEEKDAY_LONG, weekday } from '../domain/dates';
import { getExercise } from '../domain/exercises';
import { isWashDay } from '../domain/hair';
import { phaseFor } from '../domain/program';
import { buildRecommendations, consistencyBlocker, recentRecovery } from '../domain/recommendations';
import { isTrainingDay, nextSession } from '../domain/schedule';
import { weeklyAverages } from '../domain/trend';
import type {
  CareLogRow, CheckinRow, FoodLogRow, MetricRow, OverrideRow, ProductRow, ProgramRow, RoutineItemRow, SessionRow, SetLogRow, TargetRow,
} from '../domain/types';
import { buildSessionPlan, recoveryScore, reviewAfterMeasurement } from '../services';
import { Card, Field, Loading, NumberInput, Progress, Ring, fmt, useToast } from '../ui/components';
import { CheckinForm } from './Evolution';
import { usePlan } from './Nutrition';
import { useMissionData } from './Mission';
import { DAY_PASS, dayStatus, streak } from '../domain/mission';

/** Registro rápido do peso de hoje (atualiza a pesagem de hoje se já existir) e reavaliação do treino. */
function QuickWeight() {
  const store = useStore();
  const today = todayISO();
  const rows = useRows<MetricRow>('body_metrics', { eq: { date: today } });
  const existing = rows.data.find((m) => m.weight_kg !== null) ?? rows.data[0];
  const [w, setW] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, node } = useToast();
  return (
    <Card title="Peso de hoje">
      {node}
      <div className="quick">
        <Field label={existing?.weight_kg ? `Registrado: ${fmt(Number(existing.weight_kg))} kg — corrigir` : 'Em jejum, após o banheiro'}>
          <NumberInput aria-label="Peso de hoje (kg)" value={w} min={30} max={300} onChange={setW} placeholder="kg" />
        </Field>
        <button className="btn primary" disabled={busy || w === null} onClick={async () => {
          setBusy(true);
          try {
            const id = existing?.id ?? uuid();
            await store.upsert('body_metrics', existing ? { ...existing, weight_kg: w } : { id, date: today, weight_kg: w, conditions: { fasted: true, morning: true }, notes: null });
            setW(null);
            const rev = await reviewAfterMeasurement(store, id);
            toast(rev?.changes.length ? `Peso salvo. ${rev.changes.length} exercício(s) trocado(s) — veja em Treino.` : 'Peso salvo.');
          } finally { setBusy(false); }
        }}>Salvar</button>
      </div>
    </Card>
  );
}

function MissionCard() {
  const { profile } = useProfile();
  const { data, loading } = useMissionData();
  if (loading || !profile) return null;
  if (!profile.preferences.missionStart) {
    return <Card title="Missão Titan — 12 semanas" className="accent"><p>Rosto e corpo no ritmo mais rápido que ainda é seguro, gastando pouco.</p><Link className="btn primary" to="/missao">Ver a missão</Link></Card>;
  }
  const today = todayISO();
  const st = dayStatus(data, today);
  return (
    <Card title="Missão de hoje" className={st.score >= DAY_PASS ? '' : 'accent'} action={<Link className="btn sm" to="/missao">Abrir</Link>}>
      <div className="row between"><span><strong>{st.done}/{st.total}</strong> itens</span><span>🔥 {streak(data, today)} dia(s)</span></div>
      <Progress value={st.done} max={Math.max(1, st.total)} label="Missão de hoje" />
      <p className="hint">Pendentes: {st.items.filter((i) => i.done === false).map((i) => i.habit.label).slice(0, 4).join(' · ') || 'nenhum — dia cumprido!'}</p>
    </Card>
  );
}

export function Today() {
  const nav = useNavigate();
  const { profile } = useProfile();
  const today = todayISO();
  const since = addDays(today, -60);
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const logs = useRows<SetLogRow>('set_logs', { gte: { logged_at: since } });
  const overrides = useRows<OverrideRow>('exercise_overrides');
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: since } });
  const metrics = useRows<MetricRow>('body_metrics', { gte: { date: addDays(today, -90) } });
  const targets = useRows<TargetRow>('nutrition_targets', { order: { col: 'effective_from', asc: false } });
  const food = useRows<FoodLogRow>('food_logs', { gte: { date: addDays(today, -21) } });
  const products = useRows<ProductRow>('care_products');
  const careLogs = useRows<CareLogRow>('care_logs', { gte: { date: addDays(today, -40) } });
  const routine = useRows<RoutineItemRow>('routine_items');

  const program = programs.data[0] ?? null;
  const target = [...targets.data].sort((a, b) => (a.effective_from + (a.created_at ?? '') < b.effective_from + (b.created_at ?? '') ? 1 : -1))[0] ?? null;
  const plan = usePlan(target ?? undefined);

  const ctx = useMemo(() => ({
    today, profile, program, sessions: sessions.data, setLogs: logs.data, checkins: checkins.data, metrics: metrics.data,
    target, foodLogs: food.data, products: products.data, careLogs: careLogs.data,
  }), [today, profile, program, sessions.data, logs.data, checkins.data, metrics.data, target, food.data, products.data, careLogs.data]);
  const recs = useMemo(() => buildRecommendations(ctx), [ctx]);
  const blocker = useMemo(() => consistencyBlocker(ctx), [ctx]);

  if (programs.loading || sessions.loading || targets.loading) return <Loading />;

  const mine = program ? sessions.data.filter((s) => s.program_id === program.id) : [];
  const next = program ? nextSession(program, mine) : null;
  const inProgress = mine.find((s) => s.status === 'in_progress');
  const doneToday = mine.find((s) => s.status === 'done' && (s.completed_at ?? '').slice(0, 10) === today);
  const trainToday = program && isTrainingDay(program, today) && next && !next.finished;
  const day = program && next && !next.finished ? program.config.days[next.dayPos] : null;
  const recScore = recoveryScore(checkins.data);
  const planned = program && next && !next.finished ? buildSessionPlan(program, next.week, next.dayPos, overrides.data, logs.data, recScore) : [];
  const armGoal = planned.find((p) => ['biceps', 'triceps', 'brachialis'].includes(getExercise(p.exerciseKey).primary) && p.loadSuggestion !== null);

  const todayFood = food.data.filter((l) => l.date === today);
  const kcal = todayFood.reduce((s, l) => s + Number(l.kcal), 0);
  const protein = todayFood.reduce((s, l) => s + Number(l.protein_g), 0);
  const mealsLeft = plan?.meals.filter((m) => !todayFood.some((l) => l.meal === m.name)) ?? [];
  const wd = weekday(today);
  const skinSlots = (['am', 'pm'] as const).filter((s) => routine.data.some((i) => i.area === 'skin' && i.slot === s && i.enabled && i.days.includes(wd)));
  const skinDone = (s: string) => careLogs.data.some((l) => l.date === today && l.area === 'skin' && l.slot === s && l.completed && !l.product_id);
  const wash = profile ? isWashDay(profile.hair, today) : false;
  const hairDone = careLogs.data.some((l) => l.date === today && l.area === 'hair' && l.completed);
  const checkedIn = checkins.data.some((c) => c.date === today);
  const weighed = metrics.data.some((m) => m.date === today && m.weight_kg !== null);
  const rec = recentRecovery(checkins.data, today);
  const weekly = weeklyAverages(metrics.data.filter((m) => m.weight_kg !== null).map((m) => ({ date: m.date, weight: Number(m.weight_kg) })));
  const weeklyGain = Number((target?.inputs as { weeklyGainKg?: number } | undefined)?.weeklyGainKg ?? 0);
  const phase = next && program ? phaseFor(program.config, next.week, program.weeks) : null;

  const todo: { label: string; done: boolean; to: string }[] = [
    ...(trainToday ? [{ label: `Treino: ${day?.name}${profile?.training.trainingTime ? ` às ${profile.training.trainingTime}` : ''}`, done: !!doneToday, to: '/treino' }] : []),
    { label: 'Check-in de sono e recuperação', done: checkedIn, to: '/evolucao' },
    { label: 'Pesar em jejum', done: weighed, to: '/evolucao' },
    ...(plan ? [{ label: `Refeições (${plan.meals.length - mealsLeft.length}/${plan.meals.length})`, done: mealsLeft.length === 0, to: '/nutricao' }] : []),
    ...skinSlots.map((s) => ({ label: `Pele — rotina da ${s === 'am' ? 'manhã' : 'noite'}`, done: skinDone(s), to: '/cuidados' })),
    ...(wash ? [{ label: 'Lavar e finalizar o cabelo', done: hairDone, to: '/cuidados' }] : []),
  ];

  async function goTrain() {
    if (!program || !next) return;
    // Sessão nova passa pela pergunta de prontidão (TQR) na tela de Treino.
    if (!inProgress) { nav('/treino'); return; }
    nav(`/treino/sessao/${inProgress.id}`);
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = profile?.display_name?.split(' ')[0];
  const totalSets = planned.reduce((t, p) => t + p.sets, 0);
  const weights = [...metrics.data].filter((m) => m.weight_kg !== null).sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastW = weights[0] ? Number(weights[0].weight_kg) : null;
  const weekAgo = weights.find((m) => m.date <= addDays(today, -7));
  const dW = lastW !== null && weekAgo ? lastW - Number(weekAgo.weight_kg) : null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <span className="kicker">{WEEKDAY_LONG[wd]}, {formatBR(today).slice(0, 5)}</span>
          <h1>{greet}{firstName ? `, ${firstName}` : ''}</h1>
          {phase && program && !next?.finished && <p className="muted" style={{ margin: 0 }}>Semana {next!.week} de {program.weeks} · {program.name}</p>}
        </div>
      </div>

      <section className="hero" aria-label="Treino de hoje">
        <span className="pill accent">{!program ? 'Treino' : doneToday ? 'Concluído' : trainToday ? 'Treino de hoje' : 'Dia de descanso'}</span>
        <h2 style={{ marginTop: 10 }}>{!program ? 'Sem ciclo ativo' : doneToday ? 'Treino de hoje concluído ✅' : trainToday ? day?.name : day ? 'Hoje é recuperação' : 'Ciclo concluído'}</h2>
        {day && trainToday && !doneToday && (
          <div className="meta">
            <span className="pill">{planned.length} exercícios</span>
            <span className="pill">{totalSets} séries</span>
            {phase?.deload && <span className="pill accent">Deload</span>}
          </div>
        )}
        {!program ? <Link className="btn primary big" to="/treino">Abrir treino</Link>
          : trainToday && !doneToday ? <button className="btn primary big" onClick={() => void goTrain()}>{inProgress ? 'Continuar treino' : 'Iniciar treino'}</button>
            : !doneToday && day ? <p className="muted" style={{ margin: 0 }}>Aproveite para recuperar: sono, comida e água. Próxima sessão: <strong>{day.name}</strong>.</p> : null}
      </section>

      <div className="tiles">
        <Link className="tile" to="/nutricao">
          <span className="tile-l">Calorias</span>
          {target ? <Ring value={kcal} max={target.kcal} size={64} stroke={7} ariaLabel="Calorias de hoje" label={`${Math.round((kcal / target.kcal) * 100)}%`} />
            : <span className="tile-v">—</span>}
          <small className="muted">{target ? `${fmt(kcal, 0)} / ${target.kcal} kcal` : 'Defina a meta'}</small>
        </Link>
        <Link className="tile" to="/nutricao">
          <span className="tile-l">Proteína</span>
          {target ? <Ring value={protein} max={target.protein_g} size={64} stroke={7} ariaLabel="Proteína de hoje" label={`${fmt(protein, 0)}g`} />
            : <span className="tile-v">—</span>}
          <small className="muted">{target ? `meta ${target.protein_g} g` : 'Defina a meta'}</small>
        </Link>
        <div className="tile">
          <span className="tile-l">Peso</span>
          <span className="tile-v">{lastW !== null ? `${fmt(lastW)} kg` : '—'}</span>
          <small className="muted">{dW !== null ? `${dW >= 0 ? '+' : ''}${fmt(dW, 2)} kg em 7 dias` : weighed ? 'pesado hoje' : 'pese-se em jejum'}</small>
        </div>
        <div className="tile">
          <span className="tile-l">Sono (7 dias)</span>
          <span className="tile-v">{rec.sleep === null ? '—' : `${fmt(rec.sleep)} h`}</span>
          <small className="muted">{rec.recovery === null ? 'faça o check-in' : `recuperação ${fmt(rec.recovery)}/5`}</small>
        </div>
      </div>

      <QuickWeight />

      <MissionCard />

      <Card title="O que fazer hoje">
        <ul className="list">
          {todo.map((t) => (
            <li key={t.label} className="row between"><Link to={t.to} style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}>{t.done ? '✅' : '⬜'} {t.label}</Link></li>
          ))}
        </ul>
        {plan && mealsLeft.length > 0 && <p className="hint">Refeições que faltam: {mealsLeft.map((m) => `${m.time} ${m.name}`).join(' · ')}</p>}
      </Card>

      <div className="grid two">
        <Card title="Pele e cabelo">
          {skinSlots.length ? <p>Pele: {skinSlots.map((s) => `${s === 'am' ? 'manhã' : 'noite'} ${skinDone(s) ? '✅' : 'pendente'}`).join(' · ')}</p> : <p>Pele: <Link to="/cuidados">gerar rotina</Link></p>}
          <p>Cabelo: {wash ? (hairDone ? 'lavado ✅' : 'dia de lavar e finalizar') : 'sem lavagem — só reativar se precisar'}</p>
          <Link className="btn sm" to="/aparencia">Sugestões de corte, pele e massagem facial</Link>
        </Card>

        <Card title="Recuperação">
          {checkedIn ? (
            <p>Hoje: recuperação {checkins.data.find((c) => c.date === today)?.recovery ?? '—'}/5 · sono {fmt(Number(checkins.data.find((c) => c.date === today)?.sleep_hours ?? NaN))} h
              <br /><small className="muted">Média 7 dias: {rec.recovery === null ? '—' : `${fmt(rec.recovery)}/5`} · sono {rec.sleep === null ? '—' : `${fmt(rec.sleep)} h`}</small></p>
          ) : <CheckinForm compact />}
        </Card>
      </div>

      <Card title="Consistência">
        {blocker ? <p>O que mais está atrapalhando: <strong>{blocker.label}</strong> — {blocker.value} {blocker.detail}.</p>
          : <p className="muted">Nenhum hábito abaixo de 85% nos dados registrados (ou ainda não há dados suficientes).</p>}
      </Card>

      <Card title="Próximas metas mensuráveis">
        <ul className="list">
          {armGoal && <li>{armGoal.name}: <strong>{fmt(armGoal.loadSuggestion)} kg</strong> × {armGoal.repRange[0]}–{armGoal.repRange[1]} reps (RIR {armGoal.rir})<br /><small className="muted">{armGoal.suggestionReason}</small></li>}
          {weekly.length > 0 && weeklyGain > 0 && <li>Média de peso da próxima semana: ~<strong>{fmt(weekly[weekly.length - 1].avg + weeklyGain, 2)} kg</strong> (ritmo-alvo +{fmt(weeklyGain, 2)} kg/sem)</li>}
          {program && next && !next.finished && <li>Próxima avaliação (medidas e fotos): semana {(program.config.protocol === 'olympia' ? [1, 3, 5, 7, 9] : (program.config.protocol === 'jkk' || program.config.protocol === 'jkk4') ? [1, 3, 5, 7] : [1, 4, 8]).find((w) => w >= next.week) ?? program.weeks} do ciclo</li>}
          {!armGoal && weekly.length === 0 && <li className="muted">Registre treinos e pesagens para gerar metas a partir dos seus dados.</li>}
        </ul>
      </Card>

      <Card title="Recomendações">
        {recs.length === 0 ? <p className="muted">Nada a ajustar com os dados atuais.</p> : (
          <div className="stack">
            {recs.slice(0, 6).map((r) => (
              <div key={r.id} className={`card rec p${r.priority}`}>
                <strong>{r.title}</strong>
                <p className="hint">{r.reason}</p>
                <details>
                  <summary>Por quê? Dados usados e o que será monitorado</summary>
                  <ul>{r.data.map((d) => <li key={d}><small>{d}</small></li>)}</ul>
                  <small>Monitorar: {r.monitor}</small>
                </details>
              </div>
            ))}
          </div>
        )}
        <p className="hint">Recomendações vêm de regras fixas aplicadas aos seus registros (não há IA aprendendo com seus dados).</p>
      </Card>
    </div>
  );
}
