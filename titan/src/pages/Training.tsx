import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, startOfWeek, todayISO, WEEKDAY_SHORT, weekday } from '../domain/dates';
import { alternativesFor, getExercise, resolveExercise } from '../domain/exercises';
import { estimateMinutes, plannedWeeklyVolume, prescribeDay, weekPhase } from '../domain/program';
import { nextSession, projectedEnd } from '../domain/schedule';
import { weeklyVolume } from '../domain/volume';
import { MUSCLE_LABEL, type CheckinRow, type Muscle, type OverrideRow, type ProgramRow, type SessionRow, type SetLogRow } from '../domain/types';
import { createProgram, overridesMap, recoveryScore, startSession } from '../services';
import { Card, Empty, ErrorBox, Loading, fmt, useToast } from '../ui/components';
import { TrendChart } from '../ui/charts';
import { tqrLabel, weeklyLoads } from '../domain/science';

export function Training() {
  const store = useStore();
  const nav = useNavigate();
  const flash = (useLocation().state as { msg?: string } | null)?.msg;
  const { profile } = useProfile();
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const logs = useRows<SetLogRow>('set_logs', { gte: { logged_at: addDays(todayISO(), -120) } });
  const overrides = useRows<OverrideRow>('exercise_overrides');
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: addDays(todayISO(), -14) } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [askTqr, setAskTqr] = useState(false);
  const [tqr, setTqr] = useState<number | null>(null);
  const { toast, node } = useToast();
  const program = programs.data[0];
  const today = todayISO();

  const info = useMemo(() => {
    if (!program) return null;
    const mine = sessions.data.filter((s) => s.program_id === program.id);
    const next = nextSession(program, mine);
    const inProgress = mine.find((s) => s.status === 'in_progress');
    return { mine, next, inProgress, end: projectedEnd(program, mine, today) };
  }, [program, sessions.data, today]);

  if (programs.loading || sessions.loading) return <Loading />;
  if (!program || !info) {
    return (
      <Card title="Nenhum ciclo ativo">
        <p>Gere um ciclo de 8 semanas a partir do seu perfil.</p>
        <button className="btn primary" disabled={busy || !profile} onClick={async () => { setBusy(true); await createProgram(store, profile!); setBusy(false); }}>Gerar ciclo</button>
      </Card>
    );
  }

  const { next, inProgress, mine } = info;
  const phase = weekPhase(next.week, program.weeks);
  const day = program.config.days[next.dayPos];
  const ov = overridesMap(overrides.data);
  const presc = next.finished ? [] : prescribeDay(program.config, next.dayPos, next.week, program.weeks);
  const weekStart = startOfWeek(today);
  const planned = plannedWeeklyVolume(program.config, next.week, program.weeks);
  const actual = weeklyVolume(logs.data, weekStart, addDays(weekStart, 6));
  const muscles = (Object.keys(planned) as Muscle[]).filter((m) => (planned[m] ?? 0) >= 2);
  const loads = weeklyLoads(mine, logs.data).slice(-8);

  async function begin(withTqr: number | null) {
    setBusy(true); setError(null);
    try {
      const s = inProgress ?? await startSession(store, program, next.sequence, overrides.data, logs.data, recoveryScore(checkins.data), withTqr);
      nav(`/treino/sessao/${s.id}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function skip() {
    if (!confirm('Marcar esta sessão como não realizada? O ciclo segue para a próxima, sem duplicar treinos.')) return;
    const perWeek = program.config.days.length;
    await store.upsert('workout_sessions', {
      id: uuid(), program_id: program.id, week: Math.floor(next.sequence / perWeek) + 1, day_index: program.config.days[next.dayPos].dayIndex,
      sequence: next.sequence, scheduled_date: today, status: 'skipped', started_at: null, completed_at: new Date().toISOString(),
      fatigue: null, session_rpe: null, pain_notes: null, notes: 'Sessão pulada', exercises: [],
    });
    toast('Sessão marcada como pulada.');
  }

  async function swap(originalKey: string, newKey: string) {
    const existing = overrides.data.find((o) => o.exercise_key === originalKey);
    await store.upsert('exercise_overrides', { id: existing?.id ?? uuid(), exercise_key: originalKey, replacement_key: newKey, reason: 'Escolha do usuário' });
    setSwapFor(null);
    toast(`Substituído por ${getExercise(newKey).name} nas próximas sessões.`);
  }

  return (
    <div className="stack">
      {node}
      {flash && <div className="banner info" role="status">{flash}</div>}
      <div>
        <h1>Treino</h1>
        <p className="muted">{program.name} · início {formatBR(program.start_date)} · fim previsto {info.end ? formatBR(info.end) : '—'}</p>
      </div>

      <Card title="Semana" action={<span className="tag accent">Semana {Math.min(next.week, program.weeks)} de {program.weeks}</span>}>
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
            const done = mine.some((s) => s.status === 'done' && (s.completed_at ?? '').slice(0, 10) === d);
            const train = program.config.trainingDays.includes(weekday(d));
            return (
              <div key={d} className={`d ${d === today ? 'today' : ''}`}>
                {WEEKDAY_SHORT[weekday(d)]}<br /><strong>{d.slice(8)}</strong>
                <span className={`dot ${done ? 'done' : train ? 'train' : ''}`} title={done ? 'Concluído' : train ? 'Dia de treino' : 'Descanso'} />
              </div>
            );
          })}
        </div>
        <p className="hint">Ponto em destaque = dia de treino · verde = treino concluído. Fase: <strong>{phase.label}</strong> (RIR alvo {phase.rirCompound} em compostos, {phase.rirIsolation} em isolados){phase.assessment ? ' · semana de avaliação: registre medidas e fotos' : ''}.</p>
      </Card>

      {next.finished ? (
        <Card title="Ciclo concluído" className="accent">
          <p>Registre medidas e fotos de reavaliação e gere o próximo ciclo. As cargas atuais serão o ponto de partida.</p>
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await createProgram(store, profile!); setBusy(false); }}>Gerar novo ciclo</button>
        </Card>
      ) : (
        <Card className="accent" title={`Próxima sessão: ${day.name}`} action={<span className="tag">~{estimateMinutes(presc)} min</span>}>
          <p className="muted">{day.focus}</p>
          <ul className="list">
            {presc.map((s) => {
              const ex = resolveExercise(s.exerciseKey, program.config.equipment, ov.map, ov.blocked);
              return (
                <li key={s.slotId} className="row between">
                  <span><strong>{ex.name}</strong><br /><small>{MUSCLE_LABEL[ex.primary]} · {s.sets}× {ex.repRange[0]}–{ex.repRange[1]} · RIR {s.rir} · {s.restSec}s</small></span>
                  <button className="btn ghost sm" onClick={() => setSwapFor(swapFor === s.exerciseKey ? null : s.exerciseKey)}>Trocar</button>
                  {swapFor === s.exerciseKey && (
                    <div className="stack" style={{ width: '100%' }}>
                      <small>Alternativas compatíveis com seus equipamentos:</small>
                      {alternativesFor(ex.key, program.config.equipment).slice(0, 6).map((a) => (
                        <button key={a.key} className="btn sm" onClick={() => void swap(s.exerciseKey, a.key)}>{a.name}</button>
                      ))}
                      {ov.map[s.exerciseKey] && <button className="btn ghost sm" onClick={() => void swap(s.exerciseKey, s.exerciseKey)}>Voltar ao original</button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <ErrorBox error={error} />
          <div className="stack" style={{ marginTop: 10 }}>
            {askTqr && !inProgress ? (
              <div className="stack readiness">
                <label className="field">
                  <span className="field-l">Como está sua recuperação agora? (escala TQR 6–20)</span>
                  <select aria-label="Prontidão TQR" value={tqr ?? ''} onChange={(e) => setTqr(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Escolha…</option>
                    {Array.from({ length: 15 }, (_, i) => 20 - i).map((v) => <option key={v} value={v}>{v} — {tqrLabel(v)}</option>)}
                  </select>
                </label>
                <p className="hint">Abaixo de 13, o Titan tira 1 série de cada exercício e aumenta o RIR em 1 só hoje (periodização flexível). "Um treino leve é melhor que faltar."</p>
                <button className="btn primary big" disabled={busy || tqr === null} onClick={() => void begin(tqr)}>Começar</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => void begin(null)}>Pular esta pergunta</button>
              </div>
            ) : (
              <button className="btn primary big" disabled={busy} onClick={() => (inProgress ? void begin(null) : setAskTqr(true))}>{inProgress ? 'Continuar treino' : 'Iniciar treino'}</button>
            )}
            {!inProgress && !askTqr && <button className="btn ghost sm" onClick={() => void skip()}>Não vou treinar esta sessão</button>}
          </div>
        </Card>
      )}

      <Card title="Volume semanal (séries efetivas)" action={<Link className="btn sm" to="/treino/bracos">Painel de braços</Link>}>
        <p className="hint">Planejado para a semana {Math.min(next.week, program.weeks)} × realizado desde segunda. Músculo secundário conta 0,5.</p>
        <div className="scroll-x"><table className="t">
          <thead><tr><th>Músculo</th><th>Planejado</th><th>Feito</th></tr></thead>
          <tbody>{muscles.map((m) => <tr key={m}><td>{MUSCLE_LABEL[m]}{program.config.priorities.includes(m) ? ' ★' : ''}</td><td>{fmt(planned[m])}</td><td>{fmt(actual[m] ?? 0)}</td></tr>)}</tbody>
        </table></div>
      </Card>

      <Card title="Carga de treino por semana" action={<Link className="btn sm" to="/biblioteca">Biblioteca</Link>}>
        {loads.length === 0 ? <Empty>Conclua treinos informando o esforço (PSE) para ver a carga semanal.</Empty> : (
          <>
            <TrendChart label="Carga interna semanal (PSE × minutos)" data={loads.map((w) => ({ week: w.weekStart, load: w.load }))} xKey="week" series={[{ key: 'load', label: 'Carga (UA)' }]} height={180} />
            <div className="scroll-x"><table className="t">
              <thead><tr><th>Semana de</th><th>Sessões</th><th>Carga (UA)</th><th>Tonelagem</th></tr></thead>
              <tbody>{loads.slice(-6).reverse().map((w) => <tr key={w.weekStart}><td>{formatBR(w.weekStart)}</td><td>{w.sessions}</td><td>{w.load}{w.loadMissing ? ` (+${w.loadMissing} sem PSE)` : ''}</td><td>{w.tonnage.toLocaleString('pt-BR')} kg</td></tr>)}</tbody>
            </table></div>
          </>
        )}
        <p className="hint">Carga interna = PSE da sessão (0–10) × minutos. Tonelagem = séries × repetições × kg. Suba a carga aos poucos: saltos grandes de uma semana para outra aumentam o risco de lesão e de queda de desempenho.</p>
      </Card>

      <Card title="Divisão do ciclo">
        {program.config.days.map((d, i) => (
          <details key={i}>
            <summary>{WEEKDAY_SHORT[d.dayIndex]} — {d.name} (~{estimateMinutes(d.slots)} min)</summary>
            <ul className="list">{d.slots.map((s) => <li key={s.slotId}>{resolveExercise(s.exerciseKey, program.config.equipment, ov.map, ov.blocked).name} — {s.sets} séries base</li>)}</ul>
          </details>
        ))}
        {program.config.notes.map((n, i) => <p key={i} className="hint">• {n}</p>)}
        <p className="hint">Semanas 1–7: progressão gradual de esforço; +1 série/semana nos músculos ★ a partir da semana 4; semana 8: deload (metade das séries, ~85% da carga) e reavaliação. Se o app detectar queda de desempenho com recuperação ruim, ele recomenda antecipar o deload.</p>
        <button className="btn ghost sm" onClick={async () => { if (confirm('Arquivar o ciclo atual e gerar um novo a partir do perfil?')) await createProgram(store, profile!); }}>Regerar ciclo (ex.: mudei de academia)</button>
      </Card>

      <Card title="Histórico">
        {mine.filter((s) => s.status !== 'in_progress').length === 0 ? <Empty>Nenhuma sessão registrada ainda.</Empty> : (
          <ul className="list">
            {[...mine].filter((s) => s.status !== 'in_progress').sort((a, b) => b.sequence - a.sequence).slice(0, 12).map((s) => (
              <li key={s.id} className="row between">
                <span>S{s.week} · {program.config.days[s.sequence % program.config.days.length]?.name}<br /><small>{s.completed_at ? formatBR(s.completed_at.slice(0, 10)) : '—'}</small></span>
                {s.status === 'done' ? <Link className="btn ghost sm" to={`/treino/sessao/${s.id}`}>Ver</Link> : <span className="tag warn">pulada</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
