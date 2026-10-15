import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProfile, useRows } from '../data/AppContext';
import { addDays, formatBR, todayISO, WEEKDAY_LONG, weekday } from '../domain/dates';
import { getExercise } from '../domain/exercises';
import { isWashDay } from '../domain/hair';
import { weekPhase } from '../domain/program';
import { buildRecommendations, consistencyBlocker, recentRecovery } from '../domain/recommendations';
import { isTrainingDay, nextSession } from '../domain/schedule';
import { weeklyAverages } from '../domain/trend';
import type {
  CareLogRow, CheckinRow, FoodLogRow, MetricRow, OverrideRow, ProductRow, ProgramRow, RoutineItemRow, SessionRow, SetLogRow, TargetRow,
} from '../domain/types';
import { buildSessionPlan, recoveryScore } from '../services';
import { Card, Loading, Progress, fmt } from '../ui/components';
import { CheckinForm } from './Evolution';
import { usePlan } from './Nutrition';

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
  const phase = next ? weekPhase(next.week, program?.weeks) : null;

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

  return (
    <div className="stack">
      <div>
        <h1>{WEEKDAY_LONG[wd]}, {formatBR(today).slice(0, 5)}{profile?.display_name ? ` · ${profile.display_name}` : ''}</h1>
        {phase && program && !next?.finished && <p className="muted">Semana {next!.week} de {program.weeks} · {phase.label}</p>}
      </div>

      <Card title="O que fazer hoje">
        <ul className="list">
          {todo.map((t) => (
            <li key={t.label} className="row between"><Link to={t.to} style={{ color: 'inherit', textDecoration: 'none', flex: 1 }}>{t.done ? '✅' : '⬜'} {t.label}</Link></li>
          ))}
        </ul>
      </Card>

      <div className="grid two">
        <Card title="Treino" className={trainToday && !doneToday ? 'accent' : ''}>
          {!program ? <p>Sem ciclo ativo. <Link to="/treino">Gerar</Link></p>
            : doneToday ? <p>✅ Treino de hoje concluído.</p>
              : trainToday ? (
                <>
                  <p><strong>{day?.name}</strong> — {day?.focus}</p>
                  <p className="hint">{planned.length} exercícios · {planned.reduce((s, p) => s + p.sets, 0)} séries efetivas</p>
                  <button className="btn primary big" onClick={() => void goTrain()}>{inProgress ? 'Continuar treino' : 'Iniciar treino'}</button>
                </>
              ) : <p>Dia de descanso. Próxima sessão: <strong>{day?.name ?? '—'}</strong>.</p>}
        </Card>

        <Card title="Nutrição">
          {!target ? <p>Meta não calculada. <Link to="/nutricao">Configurar</Link></p> : (
            <>
              <div className="row between"><span>{fmt(kcal, 0)} / {target.kcal} kcal</span><span>P {fmt(protein, 0)} / {target.protein_g} g</span></div>
              <Progress value={kcal} max={target.kcal} label="Calorias" />
              <p className="hint">Faltam: {mealsLeft.length ? mealsLeft.map((m) => `${m.time} ${m.name}`).join(' · ') : 'nenhuma refeição'}</p>
            </>
          )}
        </Card>

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
          {program && next && !next.finished && <li>Próxima avaliação (medidas e fotos): semana {[1, 4, 8].find((w) => w >= next.week) ?? 8} do ciclo</li>}
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
