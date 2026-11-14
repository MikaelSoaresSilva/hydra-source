import { useMemo, useState } from 'react';
import { useRows } from '../data/AppContext';
import { addDays, formatBR, startOfWeek, todayISO } from '../domain/dates';
import { EXERCISE_BY_KEY } from '../domain/exercises';
import { plannedWeeklyVolume } from '../domain/program';
import { bestE1RM, groupHistory } from '../domain/progression';
import { weeklyVolume, frequency } from '../domain/volume';
import type { CheckinRow, MetricRow, ProgramRow, SetLogRow } from '../domain/types';
import { BarsChart, TrendChart } from '../ui/charts';
import { Card, Empty, Loading, fmt } from '../ui/components';

const ARM = ['biceps', 'brachialis', 'triceps'] as const;
const LABEL = { biceps: 'Bíceps', brachialis: 'Braquial', triceps: 'Tríceps' };

export function Arms() {
  const today = todayISO();
  const from = addDays(startOfWeek(today), -7 * 9);
  const logs = useRows<SetLogRow>('set_logs', { gte: { logged_at: from } });
  const metrics = useRows<MetricRow>('body_metrics', { order: { col: 'date' } });
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: from } });
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const [muscle, setMuscle] = useState<(typeof ARM)[number]>('biceps');

  const weeks = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i))), [today]);
  const volumeData = weeks.map((w) => {
    const v = weeklyVolume(logs.data, w, addDays(w, 6));
    const rec = checkins.data.filter((c) => c.date >= w && c.date <= addDays(w, 6) && c.recovery !== null);
    return { semana: formatBR(w).slice(0, 5), Bíceps: v.biceps ?? 0, Braquial: v.brachialis ?? 0, Tríceps: v.triceps ?? 0,
      recuperação: rec.length ? rec.reduce((s, c) => s + (c.recovery ?? 0), 0) / rec.length : null, weekStart: w };
  });
  const armLogs = logs.data.filter((l) => ARM.includes(EXERCISE_BY_KEY[l.exercise_key]?.primary as never));
  const exercises = Array.from(new Set(armLogs.filter((l) => EXERCISE_BY_KEY[l.exercise_key]?.primary === muscle).map((l) => l.exercise_key)));
  const perf = exercises.map((k) => ({ key: k, hist: groupHistory(armLogs, k).reverse() }));
  const armMeasures = metrics.data.filter((m) => m.arm_right_cm !== null || m.arm_left_cm !== null)
    .map((m) => ({ date: m.date, direito: m.arm_right_cm === null ? null : Number(m.arm_right_cm), esquerdo: m.arm_left_cm === null ? null : Number(m.arm_left_cm) }));
  const program = programs.data[0];
  const planned = program ? plannedWeeklyVolume(program.config, 1, program.weeks) : {};

  if (logs.loading) return <Loading />;
  const thisWeek = volumeData[volumeData.length - 1];
  return (
    <div className="stack">
      <div><h1>Especialização de braços</h1><p className="muted">Bíceps, braquial e tríceps — dados dos seus treinos registrados.</p></div>

      <Card title="Esta semana">
        <div className="stats">
          {ARM.map((m) => (
            <div className="stat" key={m}>
              <span className="stat-l">{LABEL[m]}</span>
              <strong className="stat-v">{fmt(thisWeek[LABEL[m] as 'Bíceps'])}</strong>
              <span className="stat-s">séries · plano ~{fmt(planned[m] ?? 0)} · {frequency(logs.data, m, weeks[7], addDays(weeks[7], 6))}× na semana</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Volume semanal (8 semanas)">
        {armLogs.length ? <BarsChart label="Séries semanais de bíceps e tríceps" data={volumeData} xKey="semana" series={[{ key: 'Bíceps', label: 'Bíceps' }, { key: 'Tríceps', label: 'Tríceps' }]} />
          : <Empty>Registre treinos para ver o volume real.</Empty>}
        <p className="hint">Braquial (rosca martelo/inversa) aparece na tabela e no resumo acima. Séries indiretas (puxadas, supinos) contam 0,5.</p>
      </Card>

      <Card title="Desempenho nos exercícios" action={
        <select value={muscle} onChange={(e) => setMuscle(e.target.value as 'biceps')} aria-label="Músculo" style={{ width: 'auto' }}>
          {ARM.map((m) => <option key={m} value={m}>{LABEL[m]}</option>)}
        </select>}>
        {perf.length === 0 ? <Empty>Sem registros para este músculo.</Empty> : perf.map(({ key, hist }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <h3>{EXERCISE_BY_KEY[key]?.name}</h3>
            <p className="hint">Melhor série: {(() => { const b = hist.flatMap((h) => h.sets).sort((a, c) => Number(c.load_kg) - Number(a.load_kg))[0]; return b ? `${fmt(Number(b.load_kg))} kg × ${b.reps}` : '—'; })()} · {hist.length} sessões</p>
            {hist.length >= 2 && <TrendChart label={`1RM estimado em ${EXERCISE_BY_KEY[key]?.name}`} data={hist.map((h) => ({ date: h.date.slice(0, 10), e1rm: Math.round(bestE1RM(h) * 10) / 10 }))} xKey="date" series={[{ key: 'e1rm', label: '1RM estimado (kg)' }]} height={160} />}
          </div>
        ))}
        <p className="hint">1RM estimado = carga × (1 + (reps + RIR)/30). Serve para comparar tendências, não como teste máximo.</p>
      </Card>

      <Card title="Recuperação × volume de braço">
        {volumeData.some((v) => v.recuperação !== null) ? (
          <div className="scroll-x"><table className="t">
            <thead><tr><th>Semana</th><th>Séries bíceps+braquial</th><th>Séries tríceps</th><th>Recuperação média</th></tr></thead>
            <tbody>{volumeData.map((v) => <tr key={v.semana}><td>{v.semana}</td><td>{fmt(v.Bíceps + v.Braquial)}</td><td>{fmt(v.Tríceps)}</td><td>{v.recuperação === null ? '—' : `${fmt(v.recuperação)}/5`}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty>Faça check-ins diários de recuperação (tela Hoje) para cruzar com o volume.</Empty>}
      </Card>

      <Card title="Medida do braço">
        {armMeasures.length ? <TrendChart label="Circunferência do braço" data={armMeasures} xKey="date" series={[{ key: 'direito', label: 'Direito (cm)' }, { key: 'esquerdo', label: 'Esquerdo (cm)' }]} />
          : <Empty>Nenhuma medida registrada (Evolução → Medidas).</Empty>}
        <p className="hint">Padronize: mesmo horário (manhã, antes de treinar), braço relaxado ou contraído — sempre o mesmo —, fita no ponto mais largo, sem pump. A medida varia com hidratação, gordura e pump; não é prova isolada de hipertrofia. O app não promete centímetros: acompanhe junto com cargas, fotos e peso.</p>
      </Card>
    </div>
  );
}
