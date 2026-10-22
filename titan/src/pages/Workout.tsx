import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRows, useStore } from '../data/AppContext';
import { uuid } from '../data/store';
import { alternativesFor, demoSearchUrl, getExercise } from '../domain/exercises';
import { adjustNextSet, groupHistory, isPersonalRecord, suggestProgression, type SetAdjustAction } from '../domain/progression';
import { sessionLoad, sessionMinutes, tonnage } from '../domain/science';
import { MUSCLE_LABEL, type PlannedExercise, type ProgramRow, type SessionRow, type SetLogRow } from '../domain/types';
import { Card, ErrorBox, Field, Loading, NumberInput, Scale, fmt, useToast } from '../ui/components';

interface DraftSet { id?: string; load: number | null; reps: number | null; rir: number | null; done: boolean }
type Feedback = { action: SetAdjustAction; message: string; pr?: boolean };
type Draft = Record<number, { sets: DraftSet[]; pain: number; technique: boolean; notes: string; feedback?: Feedback }>;

const draftKey = (id: string) => `titan-workout-draft-${id}`;

function RestTimer({ endsAt, onClear }: { endsAt: number | null; onClear: () => void }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);
  useEffect(() => {
    if (!endsAt) return;
    fired.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  if (left === 0 && !fired.current) {
    fired.current = true;
    navigator.vibrate?.([200, 100, 200]);
  }
  return (
    <div className="timer" role="timer" aria-live="polite">
      <span>{left > 0 ? `Descanso ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Descanso concluído'}</span>
      <button className="btn sm" onClick={onClear}>{left > 0 ? 'Pular' : 'OK'}</button>
    </div>
  );
}

export function Workout() {
  const { id = '' } = useParams();
  const store = useStore();
  const nav = useNavigate();
  const sessions = useRows<SessionRow>('workout_sessions', { eq: { id } });
  const myLogs = useRows<SetLogRow>('set_logs', { eq: { session_id: id } });
  const allLogs = useRows<SetLogRow>('set_logs', { order: { col: 'logged_at', asc: false }, limit: 1500 });
  const programs = useRows<ProgramRow>('programs');
  const session = sessions.data[0];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [finish, setFinish] = useState({ fatigue: null as number | null, rpe: null as number | null, pain: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const { toast, node } = useToast();
  const readOnly = session?.status === 'done';

  // Restaura rascunho (valores digitados) + séries já salvas.
  useEffect(() => {
    if (!session || myLogs.loading || draft) return;
    let saved: Draft = {};
    try { saved = JSON.parse(localStorage.getItem(draftKey(session.id)) ?? '{}'); } catch { saved = {}; }
    const d: Draft = {};
    session.exercises.forEach((ex, i) => {
      const prev = saved[i];
      const sets: DraftSet[] = Array.from({ length: Math.max(ex.sets, prev?.sets.length ?? 0) }, (_, j) =>
        prev?.sets[j] ?? { load: ex.loadSuggestion, reps: null, rir: null, done: false });
      myLogs.data.filter((l) => l.exercise_key === ex.exerciseKey && l.kind === 'working').forEach((l) => {
        sets[l.set_index] = { id: l.id, load: Number(l.load_kg), reps: l.reps, rir: l.rir === null ? null : Number(l.rir), done: true };
      });
      d[i] = { sets, pain: prev?.pain ?? 0, technique: prev?.technique ?? true, notes: prev?.notes ?? '', feedback: prev?.feedback };
    });
    setDraft(d);
  }, [session, myLogs.loading, myLogs.data, draft]);

  useEffect(() => { if (session && draft) localStorage.setItem(draftKey(session.id), JSON.stringify(draft)); }, [session, draft]);

  const previous = useMemo(() => {
    const out: Record<string, string> = {};
    session?.exercises.forEach((ex) => {
      const h = groupHistory(allLogs.data.filter((l) => l.session_id !== id), ex.exerciseKey)[0];
      if (h) out[ex.exerciseKey] = `${h.date.slice(8, 10)}/${h.date.slice(5, 7)}: ` + h.sets.filter((s) => s.kind === 'working').map((s) => `${fmt(Number(s.load_kg))}×${s.reps}`).join(', ');
    });
    return out;
  }, [session, allLogs.data, id]);

  const nextChanges = useMemo(() => {
    if (!session) return [];
    const LABEL: Record<string, [string, string]> = {
      increase: ['Sobe carga', 'ok'], maintain: ['Mantém, busque + reps', ''], reduce: ['Reduz carga', 'warn'],
      hold_pain: ['Dor: segura', 'danger'], hold_technique: ['Técnica: segura', 'warn'], hold_recovery: ['Recuperação: segura', 'warn'], first_time: ['', ''],
    };
    return session.exercises.flatMap((ex) => {
      const hist = groupHistory(allLogs.data, ex.exerciseKey);
      if (!hist[0] || hist[0].sessionId !== session.id) return [];
      const sug = suggestProgression(getExercise(ex.exerciseKey), ex.rir, hist);
      const [label, tone] = LABEL[sug.action];
      return [{ key: ex.exerciseKey, name: ex.name, load: sug.load, reason: sug.reason + (sug.suggestSubstitution ? ' Troque o exercício.' : ''), label, tone }];
    });
  }, [session, allLogs.data]);

  if (sessions.loading || !draft) return <Loading />;
  if (!session) return <Card><p>Sessão não encontrada.</p><Link to="/treino">Voltar</Link></Card>;
  const program = programs.data.find((p) => p.id === session.program_id);
  const locked = !!program?.config.locked;

  function update(i: number, patch: Partial<Draft[number]>) { setDraft((d) => ({ ...d!, [i]: { ...d![i], ...patch } })); }
  function updateSet(i: number, j: number, patch: Partial<DraftSet>) {
    setDraft((d) => { const sets = [...d![i].sets]; sets[j] = { ...sets[j], ...patch }; return { ...d!, [i]: { ...d![i], sets } }; });
  }

  async function logSet(i: number, j: number) {
    const ex = session.exercises[i];
    const s = draft![i].sets[j];
    if (s.load === null || s.reps === null) { toast('Informe carga e repetições.'); return; }
    if (s.reps < 0 || s.reps > 100 || s.load < 0 || s.load > 1000) { toast('Valores fora da faixa permitida.'); return; }
    const rowId = s.id ?? uuid();
    updateSet(i, j, { id: rowId, done: true });
    try {
      const r = await store.upsert('set_logs', {
        id: rowId, session_id: session.id, exercise_key: ex.exerciseKey, exercise_name: ex.name, muscle: ex.muscle, set_index: j, kind: 'working',
        load_kg: s.load, reps: Math.round(s.reps), rir: s.rir, technique_ok: draft![i].technique, pain: draft![i].pain,
        notes: draft![i].notes || null, logged_at: new Date().toISOString(),
      });
      if (r.queued) toast('Sem conexão: série salva no aparelho e será sincronizada.');
      // Autorregulação: a série registrada define a carga das próximas séries deste exercício.
      const meta = getExercise(ex.exerciseKey);
      const adj = adjustNextSet(meta, ex.rir, { load: s.load, reps: s.reps, rir: s.rir, pain: draft![i].pain, techniqueOk: draft![i].technique });
      const pr = isPersonalRecord(groupHistory(allLogs.data.filter((l) => l.session_id !== session.id), ex.exerciseKey), { load: s.load, reps: s.reps, rir: s.rir });
      setDraft((d) => {
        const cur = d![i];
        const sets = cur.sets.map((x, k) => {
          if (k <= j || x.done) return x;
          if (adj.action === 'up' || adj.action === 'down') return { ...x, load: adj.load };
          return x.load === null ? { ...x, load: s.load } : x; // primeira vez: repete o peso usado
        });
        return { ...d!, [i]: { ...cur, sets, feedback: { action: adj.action, message: `Série ${j + 1}: ${adj.message}`, pr } } };
      });
      if (pr) toast(`Novo recorde em ${ex.name}: ${fmt(s.load)} kg × ${s.reps}!`);
      setTimer(Date.now() + ex.restSec * 1000);
    } catch (e) {
      setError((e as Error).message);
      updateSet(i, j, { done: false });
    }
  }

  async function swapExercise(i: number, key: string) {
    const ex = getExercise(key);
    const old = session.exercises[i];
    const history = groupHistory(allLogs.data, key);
    const sug = suggestProgression(ex, old.rir, history);
    const exercises: PlannedExercise[] = session.exercises.map((e, k) => k === i
      ? { ...e, exerciseKey: key, name: ex.name, muscle: ex.primary, repRange: ex.repRange, loadSuggestion: sug.load, suggestionReason: sug.reason } : e);
    await store.upsert('workout_sessions', { ...session, exercises } as unknown as Record<string, unknown>);
    update(i, { sets: draft![i].sets.map(() => ({ load: sug.load, reps: null, rir: null, done: false })) });
    setSwapIdx(null);
  }

  /** Protocolo travado: troca só por dor ou aparelho indisponível, sempre pela 1ª alternativa definida no plano. */
  async function forcedSwap(i: number, reason: string) {
    const alt = alternativesFor(session.exercises[i].exerciseKey, program?.config.equipment)[0];
    if (!alt) { toast('Sem alternativa compatível: pule este exercício hoje.'); return; }
    if (!confirm(`${reason}: trocar por ${alt.name} só nesta sessão?`)) return;
    await swapExercise(i, alt.key);
    toast(`Hoje: ${alt.name}. Na próxima sessão o plano volta ao exercício original.`);
  }

  async function complete() {
    setError(null);
    try {
      await store.upsert('workout_sessions', {
        ...session, status: 'done', completed_at: new Date().toISOString(), fatigue: finish.fatigue, session_rpe: finish.rpe,
        pain_notes: finish.pain || null, notes: finish.notes || null,
      } as unknown as Record<string, unknown>);
      localStorage.removeItem(draftKey(session.id));
      nav('/treino', { state: { msg: 'Treino concluído e salvo!' } });
    } catch (e) { setError((e as Error).message); }
  }

  const doneSets = Object.values(draft).reduce((s, x) => s + x.sets.filter((y) => y.done).length, 0);
  const totalSets = Object.values(draft).reduce((s, x) => s + x.sets.length, 0);

  return (
    <div className="stack">
      {node}
      <RestTimer endsAt={timer} onClear={() => setTimer(null)} />
      <div className="row between">
        <div>
          <h1>{program?.config.days[session.sequence % (program?.config.days.length || 1)]?.name ?? 'Treino'}</h1>
          <p className="muted">Semana {session.week} · {doneSets}/{totalSets} séries {readOnly && '· concluído'}</p>
        </div>
        <Link to="/treino" className="btn ghost sm">Sair</Link>
      </div>
      {session.readiness && <div className={`banner ${session.readiness.adjusted ? '' : 'info'}`} role="status">{session.readiness.note}</div>}
      <p className="hint">Cada série é salva ao tocar em ✓ — pode fechar o app ou ficar sem internet sem perder o que já registrou.</p>

      {session.exercises.map((ex, i) => {
        const meta = getExercise(ex.exerciseKey);
        const d = draft[i];
        return (
          <Card key={i}>
            <div className="ex-head">
              <div>
                <h2>{ex.name}</h2>
                <small className="muted">{MUSCLE_LABEL[ex.muscle]} · {ex.sets} × {ex.repRange[0]}–{ex.repRange[1]} · descanso {ex.restSec}s · RIR alvo {ex.rir}</small>
              </div>
              {!readOnly && !locked && <button className="btn ghost sm" onClick={() => setSwapIdx(swapIdx === i ? null : i)}>Trocar</button>}
              {!readOnly && locked && <button className="btn ghost sm" onClick={() => void forcedSwap(i, 'Aparelho ocupado ou inexistente')}>Aparelho indisponível</button>}
            </div>
            {swapIdx === i && !locked && (
              <div className="stack" style={{ margin: '8px 0' }}>
                <small>Substituir só nesta sessão (para trocar sempre, use Treino → Trocar):</small>
                {alternativesFor(ex.exerciseKey, program?.config.equipment).slice(0, 6).map((a) => (
                  <button key={a.key} className="btn sm" onClick={() => void swapExercise(i, a.key)}>{a.name}</button>
                ))}
              </div>
            )}
            <p style={{ margin: '8px 0 2px' }}><strong>Anterior:</strong> {previous[ex.exerciseKey] ?? 'sem registro'}</p>
            <p className="hint" style={{ margin: 0 }}>{ex.loadSuggestion !== null ? `Sugestão: ${fmt(ex.loadSuggestion)} kg — ` : ''}{ex.suggestionReason}</p>
            <details>
              <summary>Aquecimento, técnica e demonstração</summary>
              <p className="hint">{ex.warmup}</p>
              <p className="hint">{meta.cues}</p>
              {(meta.primary === 'biceps' || meta.primary === 'brachialis') && <p className="hint"><strong>Bíceps:</strong> {meta.primary === 'biceps' ? 'no topo, gire o mindinho para fora (supinação máxima) e segure 1 s contraído; desça até o cotovelo quase estender.' : 'pegada neutra, cotovelo colado; o braquial cresce por baixo do bíceps e ajuda a "empurrar" o bíceps para cima.'}</p>}
              <p className="hint"><strong>Respiração:</strong> solte o ar na fase de esforço (subir/empurrar/puxar) e inspire ao voltar. Evite prender o ar, que eleva a pressão arterial.</p>
              <p className="hint"><strong>Até onde ir:</strong> pare quando a técnica quebrar (falha técnica), mesmo que ainda saia uma repetição roubada. Use amplitude completa, que rende mais que a parcial.{ex.exerciseKey.includes('bench') ? ' Supino com barra livre: nunca vá à falha sem alguém ajudando.' : ''}</p>
              <a href={demoSearchUrl(meta)} target="_blank" rel="noreferrer noopener">Buscar vídeo de demonstração ↗</a>
              <p className="hint">Prefira canais de profissionais de educação física; o link é uma busca, não um vídeo verificado.</p>
            </details>
            <div className="stack" style={{ marginTop: 8 }}>
              <div className="set-row hint"><span>#</span><span>Peso (kg)</span><span>Reps feitas</span><span>RIR</span><span /></div>
              {d.sets.map((s, j) => (
                <div className="set-row" key={j}>
                  <span className="idx">{j + 1}</span>
                  <NumberInput aria-label={`Carga série ${j + 1}`} value={s.load} min={0} max={1000} onChange={(v) => updateSet(i, j, { load: v })} />
                  <NumberInput aria-label={`Repetições série ${j + 1}`} value={s.reps} min={0} max={100} onChange={(v) => updateSet(i, j, { reps: v })} />
                  <NumberInput aria-label={`RIR série ${j + 1}`} value={s.rir} min={0} max={10} onChange={(v) => updateSet(i, j, { rir: v })} />
                  <button className={`done-btn ${s.done ? 'on' : ''}`} aria-label={`Concluir série ${j + 1}`} aria-pressed={s.done} disabled={readOnly}
                    onClick={() => void logSet(i, j)}>✓</button>
                </div>
              ))}
              {d.feedback && (
                <div className={`adjust ${d.feedback.action}`} role="status">
                  {d.feedback.pr && <strong>🏆 Recorde! </strong>}{d.feedback.message}
                  {d.feedback.action === 'stop' && !readOnly && <> <button className="btn ghost sm" onClick={() => (locked ? void forcedSwap(i, 'Dor') : setSwapIdx(i))}>Trocar exercício</button></>}
                </div>
              )}
              {!readOnly && !locked && <button className="btn ghost sm" onClick={() => update(i, { sets: [...d.sets, { load: d.sets.at(-1)?.load ?? null, reps: null, rir: null, done: false }] })}>+ série</button>}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="check"><input type="checkbox" checked={d.technique} onChange={(e) => update(i, { technique: e.target.checked })} /> Técnica ok</label>
              <label className="field" style={{ flex: 1, minWidth: 140 }}>
                <span className="field-l">Dor (0–10)</span>
                <select value={d.pain} onChange={(e) => update(i, { pain: Number(e.target.value) })}>{Array.from({ length: 11 }, (_, k) => <option key={k} value={k}>{k}{k === 0 ? ' — nenhuma' : k >= 4 ? ' — trava progressão' : ''}</option>)}</select>
              </label>
            </div>
            <Field label="Observações"><input value={d.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Ex.: pegada, banco, sensação" /></Field>
          </Card>
        );
      })}

      {nextChanges.length > 0 && (
        <Card title="O que muda no próximo treino">
          <ul className="list">{nextChanges.map((c) => (
            <li key={c.key}><span className={`tag ${c.tone}`}>{c.label}</span> <strong>{c.name}</strong>{c.load !== null ? ` → ${fmt(c.load)} kg` : ''}<br /><small className="muted">{c.reason}</small></li>
          ))}</ul>
          <p className="hint">Calculado pelas séries que você registrou hoje (peso, repetições, RIR, dor e técnica). A sugestão aparece pronta na próxima sessão deste exercício.</p>
        </Card>
      )}

      {!readOnly ? (
        <Card title="Concluir sessão">
          <Scale label="Fadiga geral agora" value={finish.fatigue} onChange={(v) => setFinish({ ...finish, fatigue: v })} low="muito descansado" high="exausto" />
          <Field label="Esforço da sessão (PSE 1–10)" hint="Pense no treino inteiro: 1 = muito leve, 5 = difícil, 10 = máximo. Junto com a duração, vira a carga interna (PSE × minutos)."><NumberInput value={finish.rpe} min={1} max={10} onChange={(v) => setFinish({ ...finish, rpe: v })} /></Field>
          <Field label="Dores ou desconfortos"><input value={finish.pain} onChange={(e) => setFinish({ ...finish, pain: e.target.value })} /></Field>
          <Field label="Observações"><textarea value={finish.notes} onChange={(e) => setFinish({ ...finish, notes: e.target.value })} /></Field>
          <ErrorBox error={error} />
          <button className="btn primary big" onClick={() => void complete()}>Concluir treino</button>
        </Card>
      ) : (
        <Card title="Resumo">
          <p>Fadiga: {session.fatigue ?? '—'}/5 · PSE: {session.session_rpe ?? '—'} · Duração: {sessionMinutes(session) ?? '—'} min</p>
          <p>Carga interna: <strong>{sessionLoad(session) ?? '—'}</strong> UA · Tonelagem: <strong>{tonnage(myLogs.data).toLocaleString('pt-BR')}</strong> kg</p>
          {session.notes && <p>{session.notes}</p>}
        </Card>
      )}
    </div>
  );
}
