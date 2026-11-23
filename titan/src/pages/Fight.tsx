import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, todayISO, weekday } from '../domain/dates';
import {
  ABSORB_TRUTH, ABS_MUSCLES, ABS_TRUTH, ABS_WORKOUTS, FIGHT_GLOSSARY, FIGHT_INTRO, FIGHT_MAX_MIN, FIGHT_PRINCIPLES, FIGHT_WEEKS, MOVES, MOVE_BY_ID,
  REFLEX_CUES, RETURN_TIPS, RETURN_WEEKS, absWorkout, blockSteps, exerciseSeconds, fightDayOf, fightSession, fightWeek, reflexGap, stepsSeconds,
  type AbsWorkoutId, type FightBlock, type FightDay, type FightExercise, type FightStep,
} from '../domain/fight';
import { nextSession } from '../domain/schedule';
import { isJkk, type CheckinRow, type JkkProtocol, type ProgramRow, type SessionRow } from '../domain/types';
import { Card, Loading, Progress, Segmented, Tabs, useToast } from '../ui/components';
import { keepScreenOn, playCue, playRestBeep, unlockAudio } from '../ui/sound';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
const dose = (e: FightExercise) => `${e.sets} × ${e.workSec >= 60 ? mmss(e.workSec) : `${e.workSec} s`}${e.perSide ? ' cada lado' : ''}${e.reps ? ` (${e.reps})` : ''}${e.sets > 1 ? ` · descanso ${e.restSec >= 60 ? mmss(e.restSec) : `${e.restSec} s`}` : ''}`;
const PHASE_LABEL = { prep: 'PREPARE-SE', work: 'AGORA', rest: 'DESCANSO' } as const;

// ------------------------------------------------------------------ cronômetro guiado (tela cheia)

/**
 * Conduz qualquer lista de passos com tempo: aquecimento, séries, rounds, descansos e trocas.
 * Bipe longo ao começar o trabalho, bipe duplo ao descansar, contagem 3-2-1 nos últimos segundos.
 */
export function GuidedTimer({ steps, title, week, onClose, onFinish }: { steps: FightStep[]; title: string; week: number; onClose: () => void; onFinish?: () => void }) {
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(steps[0]?.seconds ?? 0);
  const [cue, setCue] = useState<{ i: number; at: number } | null>(null);
  const [showHow, setShowHow] = useState(false);
  const endsAt = useRef(0);
  const lastBeep = useRef(-1);
  const nextCue = useRef(0);
  const total = stepsSeconds(steps);
  const done = steps.slice(0, idx).reduce((a, s) => a + s.seconds, 0) + (steps[idx] ? steps[idx].seconds - left : 0);
  const step = steps[idx];
  const [gapMin, gapMax] = reflexGap(week);

  function go(i: number, autoplay = running) {
    if (i >= steps.length) { setRunning(false); onFinish?.(); return; }
    const s = steps[Math.max(0, i)];
    setIdx(Math.max(0, i)); setLeft(s.seconds); setCue(null); lastBeep.current = -1;
    endsAt.current = Date.now() + s.seconds * 1000;
    nextCue.current = Date.now() + 2500;
    if (autoplay) { if (s.phase === 'work') playRestBeep(); else playCue(2); navigator.vibrate?.(s.phase === 'work' ? [300] : [120, 80, 120]); }
  }

  useEffect(() => {
    if (!running) return;
    let lock: Awaited<ReturnType<typeof keepScreenOn>> = null;
    let alive = true;
    void keepScreenOn().then((l) => { if (alive) lock = l; else void l?.release(); });
    const t = setInterval(() => {
      const ms = endsAt.current - Date.now();
      const sec = Math.ceil(ms / 1000);
      setLeft(Math.max(0, ms / 1000));
      if (sec <= 3 && sec >= 1 && lastBeep.current !== sec) { lastBeep.current = sec; playCue(1); }
      const s = steps[idx];
      if (s?.reflex && s.phase === 'work' && Date.now() >= nextCue.current && ms > 1500) {
        const i = Math.floor(Math.random() * REFLEX_CUES.length);
        playCue(REFLEX_CUES[i].beeps);
        setCue({ i, at: Date.now() });
        nextCue.current = Date.now() + (gapMin + Math.random() * (gapMax - gapMin)) * 1000;
      }
      if (ms <= 0) go(idx + 1, true);
    }, 100);
    return () => { alive = false; clearInterval(t); void lock?.release().catch(() => {}); };
  }, [running, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step) return null;
  const next = steps[idx + 1];
  const showCue = cue && Date.now() - cue.at < 1400 ? REFLEX_CUES[cue.i] : null;
  const color = step.phase === 'work' ? 'var(--accent)' : step.phase === 'prep' ? 'var(--warn)' : 'var(--info)';
  const exercise = findExercise(step.exerciseId);

  return (
    <div className="gt" role="dialog" aria-modal="true" aria-label={`Cronômetro: ${title}`}>
      <div className="gt-top">
        <span className="kicker">{title}</span>
        <button className="btn ghost sm" onClick={() => { setRunning(false); onClose(); }}>✕ Encerrar</button>
      </div>
      <Progress value={done} max={total} label="Progresso do treino" />
      <small className="muted">{step.blockTitle} · passo {idx + 1} de {steps.length} · faltam {mmss(total - done)}</small>

      <div className="gt-main" style={{ borderColor: color }}>
        <span className="pill" style={{ background: `color-mix(in srgb, ${color} 25%, transparent)` }} data-testid="gt-phase">{PHASE_LABEL[step.phase]}{step.set && step.phase === 'work' ? ` · ${step.set.n > 1 ? `${exercise && exercise.workSec >= 120 ? 'round' : 'série'} ${step.set.i}/${step.set.n}` : ''}` : ''}{step.side ? ` · lado ${step.side}` : ''}</span>
        <h2 className="gt-title">{step.title}</h2>
        <div className="gt-clock" style={{ color }} role="timer" aria-live="off" data-testid="gt-clock">{mmss(Math.ceil(left))}</div>
        {step.reflex && step.phase === 'work' ? (<>
          <p className="gt-text" data-testid="gt-cue">{step.cue}</p>
          <div aria-live="assertive" data-testid="reflex-cue" className="gt-cue" style={{ background: showCue ? 'var(--accent)' : 'var(--surface-2)', color: showCue ? 'var(--accent-ink)' : 'var(--muted)', fontSize: showCue ? '2.6rem' : '1rem' }}>
            {showCue ? <>{showCue.label}<small style={{ fontSize: '0.9rem' }}>{showCue.text}</small></> : 'Em guarda… espere o sinal'}
          </div>
        </>) : <p className="gt-text" data-testid="gt-cue">{step.cue}</p>}
        {exercise && (
          <>
            <button className="btn ghost sm" onClick={() => setShowHow(!showHow)} aria-expanded={showHow}>{showHow ? 'Esconder' : 'Como fazer'}</button>
            {showHow && <HowTo e={exercise} />}
          </>
        )}
      </div>

      <div className="gt-controls">
        <button className="btn" aria-label="Passo anterior" onClick={() => go(idx - 1)} disabled={idx === 0}>◀</button>
        <button className="btn primary big" style={{ flex: 1 }} onClick={() => {
          unlockAudio();
          if (!running) { endsAt.current = Date.now() + left * 1000; if (left === step.seconds) { if (step.phase === 'work') playRestBeep(); else playCue(2); } }
          setRunning(!running);
        }}>{running ? '⏸ Pausar' : left < step.seconds ? '▶ Continuar' : '▶ Iniciar'}</button>
        <button className="btn" aria-label="Próximo passo" onClick={() => go(idx + 1)}>▶▶</button>
      </div>
      {next && <p className="hint" style={{ textAlign: 'center' }}>Depois: <strong>{next.phase === 'rest' ? `${next.title} (${mmss(next.seconds)})` : `${next.title} · ${mmss(next.seconds)}`}</strong></p>}
    </div>
  );
}

let EX_INDEX: Record<string, FightExercise> = {};
const findExercise = (id: string) => EX_INDEX[id];
function indexExercises(blocks: FightBlock[]) { for (const b of blocks) for (const e of b.exercises) EX_INDEX[e.id] = e; }

function HowTo({ e }: { e: FightExercise }) {
  return (
    <div className="stack" style={{ gap: 6, textAlign: 'left' }}>
      <ol style={{ margin: 0, paddingLeft: 18 }}>{e.how.map((h) => <li key={h}><small>{h}</small></li>)}</ol>
      {e.roundFocus && <small className="muted"><strong>Rounds:</strong> {e.roundFocus.map((f, i) => `${i + 1}) ${f}`).join(' · ')}</small>}
      {e.muscles && <small className="muted">Trabalha: {e.muscles.map((m) => ABS_MUSCLES[m]).join(', ')}.</small>}
      {e.moves && e.moves.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer' }}><small><strong>Golpes deste exercício ({e.moves.length})</strong></small></summary>
          <ul className="list" style={{ marginTop: 6 }}>{e.moves.map((id) => { const m = MOVE_BY_ID[id]; return m ? <li key={id}><MoveCard m={m} /></li> : null; })}</ul>
        </details>
      )}
    </div>
  );
}

function MoveCard({ m }: { m: (typeof MOVES)[number] }) {
  return (
    <div>
      <strong>{m.name}</strong> <span className="tag">{m.group}</span>
      <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{m.steps.map((s) => <li key={s}><small>{s}</small></li>)}</ol>
      <small className="muted">⚠️ Erro comum: {m.error}</small>
    </div>
  );
}

// ------------------------------------------------------------------ roteiro (lista de blocos)

function BlockCard({ block, index, onStart }: { block: FightBlock; index: number; onStart: (steps: FightStep[], title: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card title={`${index + 1}. ${block.title}`} action={<span className="pill">{block.minutes} min</span>}>
      <p className="hint" style={{ marginTop: 0 }}>{block.goal}</p>
      <ul className="list">
        {block.exercises.map((e) => (
          <li key={e.id} data-testid={`ex-${e.id}`}>
            <div className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <strong>{e.name}</strong><br /><small className="muted">{dose(e)} · {mmss(exerciseSeconds(e))}</small>
              </div>
              <button className="btn sm" aria-label={`Cronômetro: ${e.name}`} onClick={() => onStart(blockSteps([{ ...block, exercises: [e] }]), e.name)}>⏱ Cronômetro</button>
            </div>
            <button className="btn ghost sm" style={{ marginTop: 4 }} aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? 'Esconder' : 'Como fazer'}</button>
            {open === e.id && <HowTo e={e} />}
          </li>
        ))}
      </ul>
      <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => onStart(blockSteps([block]), block.title)}>▶ Só este bloco ({block.minutes} min)</button>
    </Card>
  );
}

// ------------------------------------------------------------------ página

type Tab = 'treino' | 'abdomen' | 'golpes' | 'dicas';

export function Fight() {
  const store = useStore();
  const { profile, save } = useProfile();
  const today = todayISO();
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: addDays(today, -7) } });
  const { toast, node } = useToast();
  const todayFight = fightDayOf(today);
  const [tab, setTab] = useState<Tab>('treino');
  const [day, setDay] = useState<FightDay>(todayFight ?? 'sat');
  const [absId, setAbsId] = useState<AbsWorkoutId>(todayFight === 'sun' ? 'B' : todayFight === 'sat' ? 'A' : 'C');
  const [player, setPlayer] = useState<{ steps: FightStep[]; title: string; full: boolean } | null>(null);

  const program = programs.data[0];
  const protocol: JkkProtocol | null = isJkk(program?.config.protocol) ? program!.config.protocol as JkkProtocol : null;
  const gymWeek = program ? Math.min(8, nextSession(program, sessions.data.filter((s) => s.program_id === program.id)).week) : 1;
  const start = profile?.preferences.fightStart;
  const week = fightWeek(start, today);
  const recomp = profile?.preferences.goal === 'recomp';
  const wd = weekday(today);
  const dateOf = (d: FightDay) => addDays(today, d === 'sat' ? (6 - wd) % 7 : (7 - wd) % 7);
  const date = dateOf(day);
  const session = useMemo(() => fightSession(day, { week, gymWeek, protocol, withRope: recomp, date }), [day, week, gymWeek, protocol, recomp, date]);
  const abs = useMemo(() => absWorkout(absId, week), [absId, week]);
  indexExercises([...session.blocks, abs]);

  if (programs.loading || sessions.loading || !profile) return <Loading />;
  const checkin = checkins.data.find((c) => c.date === date);
  const doneToday = !!checkin?.habits?.fight;
  const canMark = date === today;

  async function mark(value: boolean) {
    const c = checkins.data.find((x) => x.date === today);
    await store.upsert('daily_checkins', {
      ...(c ?? { id: uuid(), date: today, sleep_hours: null, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null }),
      habits: { ...(c?.habits ?? {}), fight: value, ...(session.rope && value ? { rope: true } : {}) },
    } as unknown as Record<string, unknown>);
    toast(value ? (session.rope ? 'Luta registrada (a corda de hoje também).' : 'Luta registrada.') : 'Desmarcado.');
  }

  return (
    <div className="stack">
      {node}
      {player && <GuidedTimer steps={player.steps} title={player.title} week={week} onClose={() => setPlayer(null)}
        onFinish={() => { setPlayer(null); toast('🔥 Treino concluído!'); if (player.full && canMark && !doneToday) void mark(true); }} />}

      <div className="page-head">
        <div>
          <span className="kicker">Luta · {start ? `semana ${week} de ${FIGHT_WEEKS}` : 'sábado e domingo'}{session.returnPhase ? ' · retorno' : ''}</span>
          <h1>Luta em casa</h1>
          <p className="muted" style={{ margin: 0 }}>Boxe e MMA com cronômetro guiado em tudo. Até {FIGHT_MAX_MIN} min.</p>
        </div>
        <Link to="/treino" className="btn ghost sm">Academia</Link>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'treino', label: 'Treino' }, { value: 'abdomen', label: 'Abdômen' }, { value: 'golpes', label: 'Golpes' }, { value: 'dicas', label: 'Dicas' }]} />

      {tab === 'treino' && (
        <>
          {!start && (
            <Card title={FIGHT_INTRO.title} className="accent">
              <p style={{ marginTop: 0 }}>{FIGHT_INTRO.text}</p>
              <button className="btn primary" onClick={async () => { await save({ preferences: { ...profile.preferences, fightStart: today } }); toast('Treino de luta iniciado. Bora!'); }}>Começar o treino de luta</button>
              <p className="hint">Começar liga a progressão de 8 semanas e o item na Missão. Dá para ver e fazer os treinos antes.</p>
            </Card>
          )}

          <section className="hero" aria-label="Sessão de luta">
            <Segmented<FightDay> label="Dia da luta" value={day} onChange={setDay}
              options={[{ value: 'sat', label: 'Sábado', sub: 'boxe · MMA em pé · reflexo' }, { value: 'sun', label: 'Domingo', sub: 'defesa · MMA · quedas' }]} />
            <h2 style={{ marginTop: 12 }}>{session.title}</h2>
            <p className="hint" style={{ marginTop: 4 }}>{session.focus}</p>
            <div className="meta">
              <span className="pill" data-testid="fight-total">⏱ {session.totalMinutes} min</span>
              <span className="pill">{session.blocks.length} blocos</span>
              {session.rope && <span className="pill">corda incluída</span>}
              <span className="pill">abdômen {session.abs}</span>
              {todayFight === day && <span className="pill accent">hoje{doneToday ? ' · feito ✓' : ''}</span>}
              {todayFight !== day && <span className="pill">{formatBR(date)}</span>}
            </div>
            {session.returnPhase && <div className="banner info">Semanas 1–{RETURN_WEEKS}: <strong>retorno</strong>. Técnica a 60–70% de força, chutes baixos e devagar. Você ficou 1 ano parado: tendões voltam mais devagar que a técnica.</div>}
            {session.note && <div className="banner">{session.note}</div>}
            <button className="btn primary big" style={{ width: '100%', marginTop: 8 }} onClick={() => { unlockAudio(); setPlayer({ steps: blockSteps(session.blocks), title: session.title, full: true }); }}>▶ Começar treino guiado ({session.totalMinutes} min)</button>
            <p className="hint" style={{ marginBottom: 0 }}>O cronômetro passa sozinho por tudo: aquecimento, cada round, cada descanso e as trocas. Você pode pausar, voltar ou pular.</p>
            {canMark && <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => void mark(!doneToday)}>{doneToday ? 'Desmarcar a luta de hoje' : 'Já treinei: marcar como feito'}</button>}
          </section>

          <Card title="Roteiro">
            <ol className="list" style={{ margin: 0 }}>
              {session.blocks.map((b, i) => <li key={b.id} className="row between"><span>{i + 1}. {b.title}</span><small className="muted">{b.minutes} min</small></li>)}
            </ol>
          </Card>

          {session.blocks.map((b, i) => <BlockCard key={`${day}-${b.id}`} block={b} index={i} onStart={(steps, title) => { unlockAudio(); setPlayer({ steps, title, full: false }); }} />)}
        </>
      )}

      {tab === 'abdomen' && (
        <>
          <section className="hero" aria-label="Treino de abdômen">
            <div className="chips" role="radiogroup" aria-label="Treino de abdômen">
              {ABS_WORKOUTS.map((w) => <button key={w.id} type="button" role="radio" aria-checked={absId === w.id} className={`chip ${absId === w.id ? 'on' : ''}`} onClick={() => setAbsId(w.id)}>{w.id}</button>)}
            </div>
            <h2 style={{ marginTop: 10 }}>{abs.def.title}</h2>
            <p className="hint" style={{ marginTop: 4 }}>{abs.def.focus} Quando: {abs.def.when}.</p>
            <div className="meta"><span className="pill" data-testid="abs-total">⏱ {Math.round(stepsSeconds(blockSteps([abs])) / 60)} min</span><span className="pill">{abs.exercises.length} exercícios</span></div>
            <button className="btn primary big" style={{ width: '100%' }} onClick={() => { unlockAudio(); setPlayer({ steps: blockSteps([abs]), title: abs.def.title, full: false }); }}>▶ Começar abdômen {absId}</button>
          </section>
          <BlockCard block={abs} index={0} onStart={(steps, title) => { unlockAudio(); setPlayer({ steps, title, full: false }); }} />
          <Card title="Todos os músculos do abdômen">
            <div className="scroll-x"><table className="t">
              <thead><tr><th>Músculo</th><th>A</th><th>B</th><th>C</th></tr></thead>
              <tbody>{Object.entries(ABS_MUSCLES).map(([k, label]) => (
                <tr key={k}><td><small>{label}</small></td>{ABS_WORKOUTS.map((w) => <td key={w.id}>{w.exercises.some((e) => e.muscles?.includes(k)) ? '✓' : ''}</td>)}</tr>
              ))}</tbody>
            </table></div>
          </Card>
          <Card title="Forte e definido: o que funciona"><ul className="list">{ABS_TRUTH.map((t) => <li key={t}><small>{t}</small></li>)}</ul></Card>
        </>
      )}

      {tab === 'golpes' && (
        <>
          <p className="hint" style={{ margin: 0 }}>Como fazer cada movimento, em 3 passos, com o erro mais comum. Destro: jab é a mão esquerda. Canhoto: inverta tudo.</p>
          {(['Boxe', 'MMA', 'Defesa', 'Quedas'] as const).map((g) => (
            <Card key={g} title={g}>
              <ul className="list">{MOVES.filter((m) => m.group === g).map((m) => <li key={m.id}><MoveCard m={m} /></li>)}</ul>
            </Card>
          ))}
          <Card title="Números e nomes">
            <div className="scroll-x"><table className="t"><tbody>{FIGHT_GLOSSARY.map(([a, b]) => <tr key={a}><td><strong>{a}</strong></td><td><small>{b}</small></td></tr>)}</tbody></table></div>
          </Card>
        </>
      )}

      {tab === 'dicas' && (
        <>
          <Card title="Voltando depois de 1 ano parado" className="accent"><ul className="list">{RETURN_TIPS.map((t) => <li key={t}><small>{t}</small></li>)}</ul></Card>
          <Card title="Regras do treino"><ul className="list">{FIGHT_PRINCIPLES.map((p) => <li key={p.title}><small><strong>{p.title}:</strong> {p.text}</small></li>)}</ul></Card>
          <Card title={ABSORB_TRUTH.title}>
            <ul className="list">{ABSORB_TRUTH.points.map((p) => <li key={p}><small>{p}</small></li>)}</ul>
            <div className="banner">{ABSORB_TRUTH.stop}</div>
          </Card>
          <Card title="Do que precisa"><ul>{FIGHT_INTRO.equipment.map((e) => <li key={e}><small>{e}</small></li>)}</ul></Card>
          {start && <button className="btn ghost sm" onClick={async () => { if (confirm('Recomeçar a contagem das 8 semanas de luta a partir de hoje?')) await save({ preferences: { ...profile.preferences, fightStart: today } }); }}>Recomeçar as 8 semanas</button>}
        </>
      )}
    </div>
  );
}
