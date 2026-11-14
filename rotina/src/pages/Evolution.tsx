import { useApp } from '../data/AppContext';
import {
  ACHIEVEMENTS, ACHIEVEMENT_XP, DAY_GOAL, bestStreak, categoryStats, dayScore, history, levelInfo, sleepNights, sleepRegularity, streak, totalXp, weekProgress,
} from '../domain/progress';
import { buildDay } from '../domain/scheduler';
import { WEEKDAY_SHORT, durationLabel, hm, shortDate, weekday } from '../domain/time';
import { Bar, Card, Ring, fmt } from '../ui/components';

export function Evolution() {
  const { state, day } = useApp();
  const today = day.date;
  const xp = totalXp(state);
  const lv = levelInfo(xp);
  const st = streak(state, today);
  const best = bestStreak(state);
  const wk = weekProgress(state, today);
  const hist = history(state, today, 14);
  const cats = categoryStats(state, today, 7);
  const reg = sleepRegularity(state, today);
  const nights = sleepNights(state, today, 14);
  const todayScore = dayScore(state.dayLog[today]);
  const totalDone = Object.values(state.completions).reduce((a, d) => a + Object.keys(d).length, 0);
  const plan = buildDay(state, today);
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;

  return (
    <div className="stack">
      <div><span className="kicker">Sistema de evolução</span><h1>Evolução</h1></div>

      <section className="hero" aria-label="Nível">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={lv.pct} size={110} color="grad" label={`Nível ${lv.level}`}>
            <div><small>NÍVEL</small><br /><strong style={{ fontSize: '2rem' }} data-testid="level">{lv.level}</strong></div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="pill gold">⚔️ {lv.title}</span>
            <p style={{ margin: '8px 0 4px' }}><strong>{fmt(xp)} XP</strong> no total</p>
            <Bar value={lv.pct} label="XP do nível" />
            <small>Faltam {fmt(lv.need - lv.into)} XP para o nível {lv.level + 1}</small>
          </div>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="stat"><div className="v">🔥 {st}</div><div className="l">Sequência</div></div>
          <div className="stat"><div className="v">{best}</div><div className="l">Recorde</div></div>
          <div className="stat"><div className="v">{totalDone}</div><div className="l">Concluídas</div></div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}><small>XP: essencial 20 · importante 15 · flexível 10, +5 se feito no horário. Conquista: +{ACHIEVEMENT_XP} XP.</small></p>
      </section>

      <div className="grid2 resp">
        <Card title="Meta diária">
          <Ring value={todayScore / DAY_GOAL} size={88} label="Meta diária"><div><strong>{Math.round(todayScore * 100)}%</strong><br /><small>de 80%</small></div></Ring>
          <p className="muted" style={{ marginBottom: 0 }}><small>{todayScore >= DAY_GOAL ? '✅ Meta de hoje batida!' : 'Conclua 80% da rotina do dia.'}</small></p>
        </Card>
        <Card title="Meta semanal">
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 850 }}>{wk.hit}/{wk.goal}</p>
          <small className="muted">dias com 80%+ nesta semana</small>
          <div className="week" style={{ marginTop: 8 }}>
            {wk.days.map((d) => (
              <div key={d.date}><div className="d">{WEEKDAY_SHORT[weekday(d.date)][0]}</div>
                <div className={`dot ${d.score >= DAY_GOAL ? 'hit' : d.score > 0 ? 'part' : ''} ${d.date === today ? 'today' : ''}`} title={`${Math.round(d.score * 100)}%`}>{d.future ? '' : d.score >= DAY_GOAL ? '✓' : ''}</div></div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Histórico — últimos 14 dias">
        <BarsChart data={hist.map((h) => ({ label: shortDate(h.date), value: h.score, sub: h.planned ? `${h.done}/${h.planned}` : '' }))} goal={DAY_GOAL} />
        <p className="muted" style={{ marginBottom: 0 }}><small>Porcentagem da rotina concluída por dia. Linha tracejada = meta de 80%. XP nos 14 dias: {fmt(hist.reduce((a, h) => a + h.xp, 0))}.</small></p>
      </Card>

      <Card title="Atributos (consistência nos últimos 7 dias)">
        <div className="stack" style={{ gap: 10 }}>
          {cats.filter((c) => c.planned > 0 || c.category.builtin).map((c) => (
            <div key={c.category.id}>
              <div className="row between"><strong>{c.category.emoji} {c.category.name}</strong><small>{c.planned ? `${Math.round(c.rate * 100)}% · ${c.done}/${c.planned}` : 'sem dados'}</small></div>
              <div className="bar thin"><i style={{ width: `${c.rate * 100}%`, background: c.category.color }} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="🌙 Sono e recuperação">
        <div className="grid3">
          <div className="stat"><div className="v">{hm(plan.bed)}</div><div className="l">Dormir hoje</div></div>
          <div className="stat"><div className="v">{hm(plan.wake)}</div><div className="l">Acordar hoje</div></div>
          <div className="stat"><div className="v">{durationLabel(plan.sleepMinutes)}</div><div className="l">Sono planejado</div></div>
          <div className="stat"><div className="v" data-testid="sleep-reg">{reg.score ?? '—'}</div><div className="l">Regularidade</div></div>
          <div className="stat"><div className="v">{reg.avgSleep ? durationLabel(reg.avgSleep) : '—'}</div><div className="l">Média real</div></div>
          <div className="stat"><div className="v">{reg.sdMin !== null ? `±${reg.sdMin} min` : '—'}</div><div className="l">Variação</div></div>
        </div>
        <SleepChart nights={nights.map((n) => ({ label: shortDate(n.date), minutes: n.minutes }))} goalMin={state.sleep.goalMin} goalMax={state.sleep.goalMax} />
        <p className="muted" style={{ marginBottom: 0 }}><small>Como medir: marque "Dormir" quando for deitar e "Acordar" quando levantar. A regularidade (0–100) cai quanto mais o horário de acordar varia; precisa de 3 dias registrados. Faixa verde = 8–9 h.</small></p>
      </Card>

      <Card title={`Conquistas (${unlocked}/${ACHIEVEMENTS.length})`}>
        <div className="ach">
          {ACHIEVEMENTS.map((a) => {
            const at = state.achievements[a.id];
            return <div key={a.id} className={at ? '' : 'locked'} data-testid={at ? 'ach-on' : 'ach-off'}><div className="e">{a.emoji}</div><strong style={{ fontSize: '0.88rem' }}>{a.title}</strong><br /><small>{a.text}</small>{at && <><br /><small className="pill gold" style={{ marginTop: 6 }}>{shortDate(at)}</small></>}</div>;
          })}
        </div>
      </Card>
    </div>
  );
}

function BarsChart({ data, goal }: { data: { label: string; value: number; sub: string }[]; goal: number }) {
  const W = 340; const H = 150; const pad = 18; const bw = (W - pad) / data.length;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Gráfico de consistência diária">
      <defs><linearGradient id="bg1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="var(--accent)" /><stop offset="1" stopColor="var(--accent-2)" /></linearGradient></defs>
      <line x1={pad} x2={W} y1={H - goal * (H - 10)} y2={H - goal * (H - 10)} stroke="var(--accent-2)" strokeDasharray="4 4" strokeWidth="1" />
      {data.map((d, i) => {
        const h = Math.max(2, d.value * (H - 10));
        return (
          <g key={d.label}>
            <rect x={pad + i * bw + 3} y={H - h} width={bw - 6} height={h} rx="4" fill={d.value >= goal ? 'url(#bg1)' : 'var(--surface-3)'}><title>{`${d.label}: ${Math.round(d.value * 100)}% ${d.sub}`}</title></rect>
            {i % 2 === 1 && <text x={pad + i * bw + bw / 2} y={H + 13} textAnchor="middle">{d.label}</text>}
          </g>
        );
      })}
      <text x="0" y="12">100%</text><text x="0" y={H}>0</text>
    </svg>
  );
}

function SleepChart({ nights, goalMin, goalMax }: { nights: { label: string; minutes: number | null }[]; goalMin: number; goalMax: number }) {
  const W = 340; const H = 120; const pad = 22; const max = 11 * 60; const bw = (W - pad) / nights.length;
  const y = (m: number) => H - (m / max) * (H - 8);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Horas de sono por noite" style={{ marginTop: 10 }}>
      <rect x={pad} width={W - pad} y={y(goalMax)} height={y(goalMin) - y(goalMax)} fill="color-mix(in srgb, var(--ok) 15%, transparent)" />
      {nights.map((n, i) => (
        <g key={n.label}>
          {n.minutes !== null ? <rect x={pad + i * bw + 3} y={y(n.minutes)} width={bw - 6} height={H - y(n.minutes)} rx="4" fill="var(--accent)"><title>{`${n.label}: ${durationLabel(n.minutes)}`}</title></rect>
            : <rect x={pad + i * bw + 3} y={H - 2} width={bw - 6} height={2} fill="var(--surface-3)" />}
          {i % 2 === 1 && <text x={pad + i * bw + bw / 2} y={H + 13} textAnchor="middle">{n.label}</text>}
        </g>
      ))}
      <text x="0" y={y(goalMax) + 4}>9h</text><text x="0" y={y(goalMin) + 4}>8h</text>
    </svg>
  );
}
