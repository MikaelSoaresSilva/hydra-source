import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { todayISO } from '../domain/dates';
import { ROPE_CAUTIONS, ROPE_COOLDOWN, ROPE_KCAL_NOTE, ROPE_TECHNIQUE, ROPE_WARMUP, ropeFor, ropeSession, type RopeKind, type RopeSession } from '../domain/recomp';
import { nextSession } from '../domain/schedule';
import { isJkk, type CheckinRow, type JkkProtocol, type ProgramRow, type SessionRow } from '../domain/types';
import { Card, Loading, Progress, Segmented, useToast } from '../ui/components';
import { keepScreenOn, playRestBeep, unlockAudio } from '../ui/sound';
import { currentGoal } from './GoalSwitch';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Cronômetro de séries: pula / descansa, com bipe a cada troca. Mantém a tela acesa. */
export function RopeTimer({ plan, onDone }: { plan: RopeSession; onDone: () => void }) {
  // fases: [pular, descansar] × séries (sem descanso depois da última)
  const phases = useMemo(() => Array.from({ length: plan.rounds * 2 - 1 }, (_, i) => ({ work: i % 2 === 0, round: Math.floor(i / 2) + 1, sec: i % 2 === 0 ? plan.workSec : plan.restSec })), [plan]);
  const [idx, setIdx] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (idx === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    let lock: Awaited<ReturnType<typeof keepScreenOn>> = null;
    let alive = true;
    void keepScreenOn().then((l) => { if (alive) lock = l; else void l?.release(); });
    return () => { alive = false; clearInterval(t); void lock?.release().catch(() => {}); };
  }, [idx === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (idx === null || now < endsAt) return;
    playRestBeep();
    navigator.vibrate?.([250, 100, 250]);
    if (idx + 1 >= phases.length) { setIdx(null); done.current(); return; }
    setIdx(idx + 1);
    setEndsAt(Date.now() + phases[idx + 1].sec * 1000);
  }, [now, endsAt, idx, phases]);

  if (idx === null) {
    return (
      <button className="btn primary big" onClick={() => { unlockAudio(); playRestBeep(); setIdx(0); setNow(Date.now()); setEndsAt(Date.now() + phases[0].sec * 1000); }}>
        Iniciar cronômetro ({plan.rounds} × {plan.workSec} s)
      </button>
    );
  }
  const ph = phases[idx];
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <div className="stack">
      <div className="timer" role="timer" aria-live="polite" style={{ position: 'static', background: ph.work ? 'var(--accent)' : 'var(--surface-3)', color: ph.work ? 'var(--accent-ink)' : 'var(--text)' }}>
        <span>{ph.work ? 'PULE' : 'Descanse'} · {mmss(left)}</span>
        <span>Série {ph.round}/{plan.rounds}</span>
      </div>
      <Progress value={idx + 1 - left / ph.sec} max={phases.length} label="Progresso da sessão de corda" />
      <button className="btn ghost sm" onClick={() => setIdx(null)}>Parar</button>
    </div>
  );
}

export function Cardio() {
  const store = useStore();
  const { profile } = useProfile();
  const today = todayISO();
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const checkins = useRows<CheckinRow>('daily_checkins', { eq: { date: today } });
  const { toast, node } = useToast();
  const program = programs.data[0];
  const protocol: JkkProtocol = isJkk(program?.config.protocol) ? program!.config.protocol as JkkProtocol : 'jkk4';
  const scheduled = ropeFor(protocol, today);
  const [kind, setKind] = useState<RopeKind | null>(null);
  if (programs.loading || sessions.loading) return <Loading />;
  const week = program ? Math.min(8, nextSession(program, sessions.data.filter((s) => s.program_id === program.id)).week) : 1;
  const k = kind ?? scheduled ?? 'interval';
  const plan = ropeSession(k, week);
  const checkin = checkins.data[0];
  const doneToday = !!checkin?.habits?.rope;
  const recomp = currentGoal(profile) === 'recomp';

  async function mark(value: boolean) {
    await store.upsert('daily_checkins', {
      ...(checkin ?? { id: uuid(), date: today, sleep_hours: null, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null }),
      habits: { ...(checkin?.habits ?? {}), rope: value },
    } as unknown as Record<string, unknown>);
    toast(value ? 'Corda de hoje registrada.' : 'Desmarcado.');
  }

  return (
    <div className="stack">
      {node}
      <div className="page-head">
        <div>
          <span className="kicker">Cardio · semana {week} de 8</span>
          <h1>Pular corda</h1>
          <p className="muted" style={{ margin: 0 }}>{protocol === 'jkk' ? 'No plano de 5 dias: domingo (sábado já tem treino).' : 'Sábado: intervalada forte. Domingo: contínua leve.'}</p>
        </div>
        <Link to="/treino" className="btn ghost sm">Treino</Link>
      </div>
      {!recomp && <div className="banner info">A corda faz parte do objetivo "Perder gordura e ganhar massa". Você pode usar mesmo assim; para ela entrar na Missão, ative esse objetivo em Treino ou Nutrição.</div>}

      <section className="hero" aria-label="Sessão de corda">
        <span className="pill accent">{scheduled ? 'Hoje é dia de corda' : 'Hoje não é dia de corda (pode adiantar ou repor)'}{doneToday ? ' · feito ✓' : ''}</span>
        <div style={{ margin: '12px 0' }}>
          <Segmented<RopeKind> label="Tipo de sessão" value={k} onChange={setKind}
            options={[{ value: 'interval', label: 'Intervalada', sub: 'forte · sábado' }, { value: 'steady', label: 'Contínua', sub: 'leve · domingo' }]} />
        </div>
        <h2>{plan.title}</h2>
        <div className="meta">
          <span className="pill">{plan.rounds} séries</span>
          <span className="pill">{plan.workSec >= 60 ? `${plan.workSec / 60} min` : `${plan.workSec} s`} pulando</span>
          <span className="pill">{plan.restSec} s de descanso</span>
          <span className="pill">~{plan.mainMinutes + 7} min no total</span>
        </div>
        <p className="hint">Esforço: {plan.effort}. Tempo total pulando: {String(plan.totalJumpMinutes).replace('.', ',')} min.</p>
        <RopeTimer key={`${k}-${week}`} plan={plan} onDone={() => void mark(true)} />
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => void mark(!doneToday)}>{doneToday ? 'Desmarcar a corda de hoje' : 'Já fiz sem o cronômetro: marcar como feito'}</button>
      </section>

      <Card title="Passo a passo da sessão">
        <p><strong>1. Aquecimento (4 min)</strong></p><ul>{ROPE_WARMUP.map((x) => <li key={x}><small>{x}</small></li>)}</ul>
        <p><strong>2. Bloco principal ({plan.mainMinutes} min)</strong></p>
        <ul><li><small>{plan.rounds} séries de {plan.workSec} s pulando com {plan.restSec} s de descanso entre elas. O cronômetro apita a cada troca.</small></li></ul>
        <p><strong>3. Volta à calma (3 min)</strong></p><ul>{ROPE_COOLDOWN.map((x) => <li key={x}><small>{x}</small></li>)}</ul>
      </Card>

      <Card title="Progressão de 8 semanas">
        <div className="scroll-x"><table className="t">
          <thead><tr><th>Semanas</th><th>Intervalada (sáb)</th><th>Contínua (dom)</th></tr></thead>
          <tbody>{[1, 3, 5, 7].map((w) => {
            const a = ropeSession('interval', w); const b = ropeSession('steady', w);
            return <tr key={w} style={week === w || week === w + 1 ? { fontWeight: 700 } : undefined}><td>{w}–{w + 1}</td><td>{a.rounds} × {a.workSec} s / {a.restSec} s</td><td>{b.rounds} × {b.workSec / 60} min / {b.restSec} s</td></tr>;
          })}</tbody>
        </table></div>
        <p className="hint">Formato: séries × tempo pulando / descanso. A semana acompanha o seu ciclo de treino. {ROPE_KCAL_NOTE}</p>
      </Card>

      <Card title="Técnica"><ul>{ROPE_TECHNIQUE.map((x) => <li key={x}><small>{x}</small></li>)}</ul></Card>
      <Card title="Cuidados"><ul>{ROPE_CAUTIONS.map((x) => <li key={x}><small>{x}</small></li>)}</ul></Card>
    </div>
  );
}
