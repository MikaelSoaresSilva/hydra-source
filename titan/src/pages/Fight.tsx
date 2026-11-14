import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile, useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { addDays, formatBR, todayISO, weekday } from '../domain/dates';
import {
  ABSORB_TRUTH, FIGHT_GLOSSARY, FIGHT_INTRO, FIGHT_MAX_MIN, FIGHT_PRINCIPLES, FIGHT_WEEKS, REFLEX_CUES,
  fightDayOf, fightSession, fightWeek, reflexGap, type FightBlock, type FightDay,
} from '../domain/fight';
import { nextSession } from '../domain/schedule';
import { isJkk, type CheckinRow, type JkkProtocol, type ProgramRow, type SessionRow } from '../domain/types';
import { Card, Loading, Progress, Segmented, useToast } from '../ui/components';
import { keepScreenOn, playCue, playRestBeep, unlockAudio } from '../ui/sound';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Cronômetro de rounds (trabalho/descanso) com bipe a cada troca; no bloco de reflexo, dá sinais aleatórios. */
export function RoundTimer({ block, week }: { block: FightBlock; week: number }) {
  const n = block.rounds ?? 1;
  const phases = useMemo(() => Array.from({ length: n * 2 - 1 }, (_, i) => ({ work: i % 2 === 0, round: Math.floor(i / 2) + 1, sec: i % 2 === 0 ? block.workSec ?? 60 : block.restSec ?? 30 })), [block, n]);
  const [idx, setIdx] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [cue, setCue] = useState<{ i: number; at: number } | null>(null);
  const nextCue = useRef(0);
  const reflex = block.kind === 'reflex';
  const [gapMin, gapMax] = reflexGap(week);

  useEffect(() => {
    if (idx === null) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    let lock: Awaited<ReturnType<typeof keepScreenOn>> = null;
    let alive = true;
    void keepScreenOn().then((l) => { if (alive) lock = l; else void l?.release(); });
    return () => { alive = false; clearInterval(t); void lock?.release().catch(() => {}); };
  }, [idx === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (idx === null) return;
    if (now >= endsAt) {
      playRestBeep();
      navigator.vibrate?.([250, 100, 250]);
      setCue(null);
      if (idx + 1 >= phases.length) { setIdx(null); return; }
      setIdx(idx + 1);
      setEndsAt(Date.now() + phases[idx + 1].sec * 1000);
      nextCue.current = Date.now() + gapMax * 1000;
      return;
    }
    if (reflex && phases[idx].work && now >= nextCue.current && endsAt - now > 1500) {
      const i = Math.floor(Math.random() * REFLEX_CUES.length);
      playCue(REFLEX_CUES[i].beeps);
      setCue({ i, at: now });
      nextCue.current = now + (gapMin + Math.random() * (gapMax - gapMin)) * 1000;
    }
  }, [now, endsAt, idx, phases, reflex, gapMin, gapMax]);

  if (idx === null) {
    return (
      <button className="btn primary" onClick={() => {
        unlockAudio(); playRestBeep(); setIdx(0); setNow(Date.now()); setEndsAt(Date.now() + phases[0].sec * 1000); nextCue.current = Date.now() + 2500;
      }}>
        Iniciar rounds ({n} × {mmss(block.workSec ?? 60)})
      </button>
    );
  }
  const ph = phases[idx];
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const showCue = cue && now - cue.at < 1400 ? REFLEX_CUES[cue.i] : null;
  return (
    <div className="stack">
      <div className="timer" role="timer" aria-live="polite" style={{ position: 'static', background: ph.work ? 'var(--accent)' : 'var(--surface-3)', color: ph.work ? 'var(--accent-ink)' : 'var(--text)' }}>
        <span>{ph.work ? 'LUTE' : 'Descanse'} · {mmss(left)}</span>
        <span>Round {ph.round}/{n}</span>
      </div>
      {ph.work && <p style={{ margin: 0 }}><small>{block.drills[Math.min(ph.round - 1, block.drills.length - 1)]}</small></p>}
      {reflex && ph.work && (
        <div aria-live="assertive" data-testid="reflex-cue" style={{ textAlign: 'center', fontSize: showCue ? '4rem' : '1rem', fontWeight: 900, minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: 16, background: showCue ? 'var(--accent)' : 'var(--surface-2)', color: showCue ? 'var(--accent-ink)' : 'var(--muted)' }}>
          {showCue ? <>{showCue.label}<small style={{ fontSize: '0.9rem' }}>{showCue.text}</small></> : 'Em guarda… espere o sinal'}
        </div>
      )}
      <Progress value={idx + 1 - left / ph.sec} max={phases.length} label={`Progresso: ${block.title}`} />
      <button className="btn ghost sm" onClick={() => { setIdx(null); setCue(null); }}>Parar</button>
    </div>
  );
}

function BlockCard({ block, index, week }: { block: FightBlock; index: number; week: number }) {
  const timed = (block.kind === 'rounds' || block.kind === 'reflex') && block.rounds;
  return (
    <Card title={`${index + 1}. ${block.title}`} action={<span className="pill">{block.minutes} min</span>}>
      {block.rounds && block.kind !== 'rope' && <p className="hint" style={{ marginTop: 0 }}>{block.rounds} rounds de {mmss(block.workSec ?? 0)} com {block.restSec} s de descanso.</p>}
      {block.kind === 'rope' ? (
        <>
          <ul>{block.drills.map((d) => <li key={d}><small>{d}</small></li>)}</ul>
          <Link to="/cardio" className="btn sm">Abrir cronômetro da corda</Link>
        </>
      ) : (
        <ol className="list">{block.drills.map((d, i) => <li key={d}><small>{timed ? <strong>Round {i + 1}{i === block.drills.length - 1 && (block.rounds ?? 0) > block.drills.length ? ` a ${block.rounds}` : ''}: </strong> : null}{d}</small></li>)}</ol>
      )}
      {block.kind === 'reflex' && (
        <p className="hint">Sinais: {REFLEX_CUES.map((c) => `${c.beeps} bipe${c.beeps > 1 ? 's' : ''} = ${c.text.toLowerCase()}`).join(' · ')}. Nesta semana, um sinal a cada {reflexGap(week).join(' a ').replace(/\./g, ',')} s.</p>
      )}
      {block.cues && <div className="banner info" style={{ marginBottom: 8 }}>{block.cues.map((c) => <div key={c}>• {c}</div>)}</div>}
      {timed ? <RoundTimer block={block} week={week} /> : null}
    </Card>
  );
}

export function Fight() {
  const store = useStore();
  const { profile, save } = useProfile();
  const today = todayISO();
  const programs = useRows<ProgramRow>('programs', { eq: { status: 'active' } });
  const sessions = useRows<SessionRow>('workout_sessions');
  const checkins = useRows<CheckinRow>('daily_checkins', { gte: { date: addDays(today, -7) } });
  const { toast, node } = useToast();
  const todayFight = fightDayOf(today);
  const [day, setDay] = useState<FightDay>(todayFight ?? 'sat');
  if (programs.loading || sessions.loading || !profile) return <Loading />;

  const program = programs.data[0];
  const protocol: JkkProtocol | null = isJkk(program?.config.protocol) ? program!.config.protocol as JkkProtocol : null;
  const gymWeek = program ? Math.min(8, nextSession(program, sessions.data.filter((s) => s.program_id === program.id)).week) : 1;
  const start = profile.preferences.fightStart;
  const week = fightWeek(start, today);
  const recomp = profile.preferences.goal === 'recomp';
  // Data do sábado/domingo desta semana (ou o próximo) para a corda seguir o seu plano.
  const wd = weekday(today);
  const dateOf = (d: FightDay) => addDays(today, d === 'sat' ? (6 - wd) % 7 : (7 - wd) % 7);
  const session = fightSession(day, { week, gymWeek, protocol, withRope: recomp, date: dateOf(day) });
  const date = dateOf(day);
  const checkin = checkins.data.find((c) => c.date === date);
  const done = !!checkin?.habits?.fight;
  const canMark = date === today;

  async function mark(value: boolean) {
    const hasRope = !!session.rope;
    await store.upsert('daily_checkins', {
      ...(checkin ?? { id: uuid(), date, sleep_hours: null, sleep_quality: null, recovery: null, soreness: null, stress: null, notes: null }),
      habits: { ...(checkin?.habits ?? {}), fight: value, ...(hasRope && value ? { rope: true } : {}) },
    } as unknown as Record<string, unknown>);
    toast(value ? (hasRope ? 'Luta registrada (a corda de hoje também).' : 'Luta registrada.') : 'Desmarcado.');
  }

  return (
    <div className="stack">
      {node}
      <div className="page-head">
        <div>
          <span className="kicker">Luta · {start ? `semana ${week} de ${FIGHT_WEEKS}` : 'sábado e domingo'}</span>
          <h1>Luta em casa</h1>
          <p className="muted" style={{ margin: 0 }}>Fundamentos de Boxe e MMA, reflexo, pés, sentidos e aprender a apanhar. Até {FIGHT_MAX_MIN} min por dia.</p>
        </div>
        <Link to="/treino" className="btn ghost sm">Treino</Link>
      </div>

      {!start && (
        <Card title={FIGHT_INTRO.title} className="accent">
          <p>{FIGHT_INTRO.text}</p>
          <p><strong>Do que precisa</strong></p>
          <ul>{FIGHT_INTRO.equipment.map((e) => <li key={e}><small>{e}</small></li>)}</ul>
          <button className="btn primary big" onClick={async () => { await save({ preferences: { ...profile.preferences, fightStart: today } }); toast('Treino de luta iniciado. Bora!'); }}>Começar o treino de luta</button>
          <p className="hint">Você pode ver e fazer as sessões sem começar; começar só liga a progressão de 8 semanas e o item na Missão.</p>
        </Card>
      )}

      <section className="hero" aria-label="Sessão de luta">
        <span className="pill accent">{todayFight ? (todayFight === day ? 'Hoje é dia de luta' : 'Hoje é dia de luta (outra sessão)') : `Próxima: ${day === 'sat' ? 'sábado' : 'domingo'} ${formatBR(date)}`}{done ? ' · feito ✓' : ''}</span>
        <div style={{ margin: '12px 0' }}>
          <Segmented<FightDay> label="Dia da luta" value={day} onChange={setDay}
            options={[{ value: 'sat', label: 'Sábado', sub: 'ataque · pés · reflexo' }, { value: 'sun', label: 'Domingo', sub: 'defesa · MMA · apanhar' }]} />
        </div>
        <h2>{session.title}</h2>
        <p className="hint" style={{ marginTop: 4 }}>{session.focus}</p>
        <div className="meta">
          <span className="pill" data-testid="fight-total">~{session.totalMinutes} min</span>
          <span className="pill">{session.blocks.length} blocos</span>
          {session.rope && <span className="pill">corda incluída</span>}
        </div>
        {session.note && <div className="banner">{session.note}</div>}
        {!recomp && <p className="hint">A corda entra aqui quando o objetivo é "Perder gordura e ganhar massa".</p>}
        {canMark
          ? <button className="btn primary" onClick={() => void mark(!done)}>{done ? 'Desmarcar a luta de hoje' : 'Terminei a luta de hoje'}</button>
          : <p className="hint">Você marca como feito no próprio {day === 'sat' ? 'sábado' : 'domingo'}.</p>}
      </section>

      {session.blocks.map((b, i) => <BlockCard key={`${day}-${b.id}`} block={b} index={i} week={week} />)}

      <Card title={ABSORB_TRUTH.title} className="accent">
        <ul className="list">{ABSORB_TRUTH.points.map((p) => <li key={p}><small>{p}</small></li>)}</ul>
        <div className="banner">{ABSORB_TRUTH.stop}</div>
      </Card>

      <Card title="Regras do treino">
        <ul className="list">{FIGHT_PRINCIPLES.map((p) => <li key={p.title}><small><strong>{p.title}:</strong> {p.text}</small></li>)}</ul>
      </Card>

      <Card title="Números e nomes">
        <div className="scroll-x"><table className="t"><tbody>{FIGHT_GLOSSARY.map(([a, b]) => <tr key={a}><td><strong>{a}</strong></td><td><small>{b}</small></td></tr>)}</tbody></table></div>
        <p className="hint">Destro: jab é a mão esquerda. Canhoto: inverta tudo.</p>
      </Card>

      {start && <button className="btn ghost sm" onClick={async () => { if (confirm('Recomeçar a contagem das 8 semanas de luta a partir de hoje?')) await save({ preferences: { ...profile.preferences, fightStart: today } }); }}>Recomeçar as 8 semanas</button>}
    </div>
  );
}
