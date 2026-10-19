import { useMemo, useState } from 'react';
import { useGame } from '../store/game';
import { Bars, LineChart, MiniBar, Modal, Panel, Tabs } from './components';
import { addBodyLog, addEvidence, addFinanceEntry, addFinanceGoal, addKnowledgeNode, addSelfCare, addStudy, addWorkout, financeSaved, personalRecords } from '../core/engine';
import { KNOWLEDGE_TREES, MASTERY_LABEL, masteryLevel, nodeUnlocked } from '../data/knowledge';
import type { EvidenceType, KnowledgeNode, SelfCareLog, WorkoutExercise } from '../core/types';
import { addDays, dayKey, fmtMoney } from '../core/util';

export function LifeScreen() {
  const [tab, setTab] = useState<'treino' | 'estudos' | 'financas' | 'autocuidado'>('treino');
  return (
    <div className="screen-inner">
      <h1>Vida real</h1>
      <p className="small muted">Aqui ficam seus <b>dados reais</b> (cargas, horas, valores). Eles geram XP para os atributos do jogo, mas são registrados separadamente.</p>
      <Tabs value={tab} onChange={setTab} options={[['treino', 'Treino'], ['estudos', 'Estudos'], ['financas', 'Finanças'], ['autocuidado', 'Autocuidado']]} />
      {tab === 'treino' && <Training />}
      {tab === 'estudos' && <Study />}
      {tab === 'financas' && <Finance />}
      {tab === 'autocuidado' && <SelfCare />}
    </div>
  );
}

function Training() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [logging, setLogging] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const prs = personalRecords(s.workouts);
  const exNames = Object.keys(prs);
  const [chartEx, setChartEx] = useState(exNames[0] ?? '');
  const series = useMemo(() => s.workouts.filter((w) => w.exercises.some((e) => e.name.trim().toLowerCase() === chartEx)).map((w) => ({ x: w.date, y: Math.max(...w.exercises.filter((e) => e.name.trim().toLowerCase() === chartEx).flatMap((e) => e.sets.map((x) => x.kg))) })).sort((a, b) => a.x.localeCompare(b.x)), [s.workouts, chartEx]);
  const weekly = useMemo(() => Array.from({ length: 8 }).map((_, i) => { const end = addDays(dayKey(), -7 * (7 - i)); const start = addDays(end, -6); return { label: end.slice(5).split('-').reverse().join('/'), value: s.workouts.filter((w) => w.date >= start && w.date <= end).length }; }), [s.workouts]);
  const weights = s.body.filter((b) => b.weightKg).map((b) => ({ x: b.date, y: b.weightKg! })).sort((a, b) => a.x.localeCompare(b.x));
  return (
    <>
      <div className="row gap wrap" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={() => setLogging(true)} data-testid="log-workout">+ Registrar treino</button>
        <button className="btn" onClick={() => setBodyOpen(true)}>+ Medidas / peso</button>
      </div>
      <Panel title="Treinos por semana"><Bars data={weekly} color="#ff9f43" /></Panel>
      <Panel title="Recordes pessoais (carga máxima)">
        {exNames.length === 0 ? <p className="muted small">Registre treinos com carga para ver recordes.</p> : (
          <>
            {exNames.map((k) => <div key={k} className="row between small" style={{ padding: '3px 0' }}><span style={{ textTransform: 'capitalize' }}>{k}</span><span className="mono">{prs[k].kg} kg × {prs[k].reps} · {prs[k].date.split('-').reverse().join('/')}</span></div>)}
            <label className="field" style={{ marginTop: 10 }}>Evolução de carga
              <select value={chartEx} onChange={(e) => setChartEx(e.target.value)}>{exNames.map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <LineChart series={[{ name: chartEx, color: '#ff6b6b', points: series }]} unit="kg" />
          </>
        )}
      </Panel>
      <Panel title="Peso corporal"><LineChart series={[{ name: 'Peso', color: '#5fd38d', points: weights }]} unit="kg" /></Panel>
      <Panel title="Histórico">
        {s.workouts.length === 0 && <p className="muted small">Nenhum treino registrado.</p>}
        {[...s.workouts].reverse().slice(0, 20).map((w) => (
          <details key={w.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <summary>{w.date.split('-').reverse().join('/')} · {w.exercises.length} exercício(s) · {w.durationMin} min · esforço {w.rpe}/10</summary>
            <ul className="small">{w.exercises.map((e, i) => <li key={i}>{e.name}: {e.sets.map((x) => `${x.reps}×${x.kg}kg`).join(', ')}{e.restSec ? ` · descanso ${e.restSec}s` : ''}</li>)}</ul>
            {w.notes && <p className="small muted">{w.notes}</p>}
          </details>
        ))}
      </Panel>
      <Panel title="Segurança"><p className="small muted" style={{ margin: 0 }}>O jogo limita o XP a 2 treinos por dia para não incentivar excesso. Respeite dores, recuperação e orientação profissional. O avatar não representa medidas reais do seu corpo.</p></Panel>
      {logging && <WorkoutForm onClose={() => setLogging(false)} />}
      {bodyOpen && <BodyForm onClose={() => setBodyOpen(false)} />}
      <BodyPhotos onRemove={(id) => act((d) => { const b = d.body.find((x) => x.id === id); if (b) delete b.photo; })} />
    </>
  );
}

function BodyPhotos({ onRemove }: { onRemove: (id: string) => void }) {
  const s = useGame((x) => x.s);
  const photos = s.body.filter((b) => b.photo);
  if (!photos.length) return null;
  return (
    <Panel title="Fotos de progresso (somente neste aparelho)">
      <div className="row gap wrap">{photos.map((p) => <div key={p.id} style={{ textAlign: 'center' }}><img src={p.photo} alt={p.date} style={{ width: 100, borderRadius: 8 }} /><div className="small">{p.date.split('-').reverse().join('/')}</div><button className="chip" onClick={() => onRemove(p.id)}>remover</button></div>)}</div>
    </Panel>
  );
}

function WorkoutForm({ onClose }: { onClose: () => void }) {
  const act = useGame((x) => x.act);
  const [date, setDate] = useState(dayKey());
  const [duration, setDuration] = useState(45);
  const [rpe, setRpe] = useState(7);
  const [notes, setNotes] = useState('');
  const [exs, setExs] = useState<WorkoutExercise[]>([{ name: '', sets: [{ reps: 10, kg: 0 }], restSec: 90 }]);
  const [err, setErr] = useState('');
  const upd = (i: number, p: Partial<WorkoutExercise>) => setExs(exs.map((e, j) => (j === i ? { ...e, ...p } : e)));
  return (
    <Modal onClose={onClose} title="Registrar treino">
      <div className="row gap"><label className="field grow">Data<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="field grow">Duração (min)<input type="number" min={0} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label></div>
      <label className="field">Percepção de esforço: {rpe}/10<input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} /></label>
      {exs.map((ex, i) => (
        <div key={i} className="panel" style={{ padding: 10 }}>
          <div className="row gap"><input type="text" placeholder="Exercício (ex.: Supino)" value={ex.name} onChange={(e) => upd(i, { name: e.target.value })} aria-label="Exercício" /><button className="icon-btn" onClick={() => setExs(exs.filter((_, j) => j !== i))}>✕</button></div>
          {ex.sets.map((st, k) => (
            <div key={k} className="row gap" style={{ marginTop: 6 }}>
              <span className="small muted" style={{ width: 50 }}>Série {k + 1}</span>
              <input type="number" min={0} value={st.reps} onChange={(e) => upd(i, { sets: ex.sets.map((x, j) => (j === k ? { ...x, reps: Number(e.target.value) } : x)) })} aria-label="Repetições" />
              <span className="small">reps</span>
              <input type="number" min={0} step={0.5} value={st.kg} onChange={(e) => upd(i, { sets: ex.sets.map((x, j) => (j === k ? { ...x, kg: Number(e.target.value) } : x)) })} aria-label="Carga" />
              <span className="small">kg</span>
            </div>
          ))}
          <div className="row gap" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={() => upd(i, { sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] })}>+ série</button>
            <label className="small row gap">Descanso (s)<input type="number" min={0} value={ex.restSec ?? 0} style={{ width: 80 }} onChange={(e) => upd(i, { restSec: Number(e.target.value) })} /></label>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => setExs([...exs, { name: '', sets: [{ reps: 10, kg: 0 }], restSec: 90 }])}>+ exercício</button>
      <label className="field" style={{ marginTop: 10 }}>Notas<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
      <div className="row gap" style={{ justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => {
        const ev = act((d, e) => addWorkout(d, e, { date, exercises: exs, durationMin: duration, rpe, notes }));
        const er = ev.find((x) => x.kind === 'error'); if (er && er.kind === 'error') setErr(er.text); else onClose();
      }}>Salvar treino</button></div>
    </Modal>
  );
}

function BodyForm({ onClose }: { onClose: () => void }) {
  const act = useGame((x) => x.act);
  const [v, setV] = useState({ date: dayKey(), weightKg: '', waistCm: '', chestCm: '', armCm: '' });
  const [photo, setPhoto] = useState<string | undefined>();
  const onFile = (f?: File) => { if (!f) return; const img = new Image(); const u = URL.createObjectURL(f); img.onload = () => { const sc = Math.min(1, 600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); setPhoto(c.toDataURL('image/jpeg', 0.8)); URL.revokeObjectURL(u); }; img.src = u; };
  const num = (x: string) => (x ? Number(x) : undefined);
  return (
    <Modal onClose={onClose} title="Medidas corporais">
      <label className="field">Data<input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></label>
      <div className="row gap wrap">
        {([['weightKg', 'Peso (kg)'], ['waistCm', 'Cintura (cm)'], ['chestCm', 'Peito (cm)'], ['armCm', 'Braço (cm)']] as const).map(([k, l]) => <label key={k} className="field" style={{ width: 130 }}>{l}<input type="number" step={0.1} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>)}
      </div>
      <label className="btn small">Foto de progresso (opcional, fica só no aparelho)<input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
      {photo && <img src={photo} alt="prévia" style={{ width: 120, display: 'block', marginTop: 8, borderRadius: 8 }} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}><button className="btn primary" onClick={() => { act((d) => addBodyLog(d, { date: v.date, weightKg: num(v.weightKg), waistCm: num(v.waistCm), chestCm: num(v.chestCm), armCm: num(v.armCm), photo })); onClose(); }}>Salvar</button></div>
    </Modal>
  );
}

function Study() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [minutes, setMinutes] = useState(25);
  const [nodeId, setNodeId] = useState('');
  const [note, setNote] = useState('');
  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [newNode, setNewNode] = useState(false);
  const totalMin = s.study.reduce((t, x) => t + x.minutes, 0);
  const daily = useMemo(() => Array.from({ length: 14 }).map((_, i) => { const d = addDays(dayKey(), i - 13); return { label: d.slice(8), value: s.study.filter((x) => x.date === d).reduce((t, x) => t + x.minutes, 0) }; }), [s.study]);
  const trees = [...new Set(s.knowledge.map((k) => k.tree))];
  return (
    <>
      <Panel title={`Sessão de estudo · total ${Math.round(totalMin / 6) / 10} h`}>
        <div className="row gap wrap">
          <label className="field" style={{ width: 110 }}>Minutos<input type="number" min={1} max={720} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <label className="field grow">Habilidade (opcional)<select value={nodeId} onChange={(e) => setNodeId(e.target.value)}><option value="">—</option>{s.knowledge.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
        </div>
        <input type="text" placeholder="O que estudou?" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" style={{ marginTop: 8 }} onClick={() => { act((d, ev) => addStudy(d, ev, { date: dayKey(), minutes, nodeId: nodeId || undefined, note })); setNote(''); }}>Registrar sessão</button>
        <Bars data={daily} color="#48dbfb" />
      </Panel>
      {trees.map((t) => (
        <Panel key={t} title={KNOWLEDGE_TREES[t]?.name ?? t}>
          {s.knowledge.filter((k) => k.tree === t).map((k) => {
            const lv = masteryLevel(k); const open = nodeUnlocked(k, s.knowledge);
            return (
              <div key={k.id} className="skill" style={{ '--bc': KNOWLEDGE_TREES[t]?.color ?? '#4cc9ff', opacity: open ? 1 : 0.5, cursor: 'pointer' } as React.CSSProperties} onClick={() => setNode(k)}>
                <div className="grow">
                  <div className="row between"><b>{k.name}</b><span className="chip" style={lv === 4 ? { color: 'var(--gold)', borderColor: 'var(--gold)' } : undefined}>{MASTERY_LABEL[lv]}</span></div>
                  <MiniBar value={lv} max={4} color={KNOWLEDGE_TREES[t]?.color ?? '#4cc9ff'} />
                  {!open && <p className="small muted" style={{ margin: '4px 0 0' }}>Requer: {k.prereqs.map((p) => s.knowledge.find((x) => x.id === p)?.name).join(', ')} (nível Praticante)</p>}
                </div>
              </div>
            );
          })}
        </Panel>
      ))}
      <button className="btn" onClick={() => setNewNode(true)}>+ Nova habilidade/trilha</button>
      {node && <NodeModal nodeId={node.id} onClose={() => setNode(null)} />}
      {newNode && <NewNodeModal onClose={() => setNewNode(false)} />}
    </>
  );
}

function NodeModal({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const n = s.knowledge.find((k) => k.id === nodeId)!;
  const [type, setType] = useState<EvidenceType>('exercicio');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [score, setScore] = useState(80);
  const [err, setErr] = useState('');
  const lv = masteryLevel(n);
  return (
    <Modal onClose={onClose} title={n.name}>
      <p>{n.description}</p>
      <p className="small">Domínio: <b>{MASTERY_LABEL[lv]}</b> ({lv}/4)</p>
      <p className="small muted">Regra: aulas e vídeos levam no máximo ao nível Aprendiz. Para <b>Dominado</b> é preciso um <b>projeto</b> + exercício prático ou teste com nota ≥ 70.</p>
      <div className="panel" style={{ padding: 10 }}>
        <label className="field">Tipo de evidência
          <select value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
            <option value="licao">Lição / aula / vídeo</option><option value="exercicio">Exercício prático</option><option value="teste">Teste (com nota)</option><option value="projeto">Projeto entregue</option><option value="revisao">Revisão</option><option value="link">Link / material</option>
          </select>
        </label>
        <input type="text" placeholder="Descrição (o que você fez)" value={note} onChange={(e) => setNote(e.target.value)} />
        <input type="url" placeholder="Link da entrega (repositório, arquivo) — opcional" value={url} onChange={(e) => setUrl(e.target.value)} style={{ marginTop: 6 }} />
        {type === 'teste' && <label className="field" style={{ marginTop: 6 }}>Nota: {score}<input type="range" min={0} max={100} value={score} onChange={(e) => setScore(Number(e.target.value))} /></label>}
        {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
        <button className="btn primary" style={{ marginTop: 8 }} disabled={note.trim().length < 3} onClick={() => {
          const ev = act((d, e) => addEvidence(d, e, n.id, { type, note: note.trim(), url: url.trim() || undefined, score: type === 'teste' ? score : undefined }));
          const er = ev.find((x) => x.kind === 'error'); if (er && er.kind === 'error') setErr(er.text); else { setNote(''); setUrl(''); setErr(''); }
        }}>Registrar evidência</button>
      </div>
      <h3>Evidências ({n.evidence.length})</h3>
      {n.evidence.length === 0 && <p className="small muted">Nenhuma ainda.</p>}
      <ul className="small" style={{ paddingLeft: 16 }}>{[...n.evidence].reverse().map((e) => <li key={e.id}><b>{e.type}</b>: {e.note}{e.score != null ? ` (nota ${e.score})` : ''}{e.url && <> · <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>link</a></>} <span className="muted">{new Date(e.at).toLocaleDateString('pt-BR')}</span></li>)}</ul>
    </Modal>
  );
}

function NewNodeModal({ onClose }: { onClose: () => void }) {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [name, setName] = useState(''); const [desc, setDesc] = useState(''); const [tree, setTree] = useState('backend'); const [newTree, setNewTree] = useState(''); const [prereq, setPrereq] = useState('');
  const trees = [...new Set(s.knowledge.map((k) => k.tree))];
  return (
    <Modal onClose={onClose} title="Nova habilidade">
      <label className="field">Nome<input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">O que significa dominar?<textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="field">Trilha<select value={tree} onChange={(e) => setTree(e.target.value)}>{trees.map((t) => <option key={t} value={t}>{KNOWLEDGE_TREES[t]?.name ?? t}</option>)}<option value="__nova">+ Nova trilha</option></select></label>
      {tree === '__nova' && <input type="text" placeholder="Nome da trilha" value={newTree} onChange={(e) => setNewTree(e.target.value)} />}
      <label className="field">Pré-requisito<select value={prereq} onChange={(e) => setPrereq(e.target.value)}><option value="">Nenhum</option>{s.knowledge.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
      <button className="btn primary" disabled={name.trim().length < 2 || (tree === '__nova' && !newTree.trim())} onClick={() => { act((d) => addKnowledgeNode(d, { name: name.trim(), description: desc.trim(), tree: tree === '__nova' ? newTree.trim() : tree, prereqs: prereq ? [prereq] : [] })); onClose(); }}>Criar</button>
    </Modal>
  );
}

function Finance() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [gName, setGName] = useState(''); const [gTarget, setGTarget] = useState('');
  const [amount, setAmount] = useState(''); const [kind, setKind] = useState<'economia' | 'gasto' | 'renda'>('economia'); const [goalId, setGoalId] = useState(''); const [note, setNote] = useState('');
  const month = dayKey().slice(0, 7);
  const monthEntries = s.finance.entries.filter((e) => e.date.startsWith(month));
  const sum = (k: string) => monthEntries.filter((e) => e.kind === k).reduce((t, e) => t + e.amount, 0);
  let acc = 0;
  const savedSeries = [...s.finance.entries].filter((e) => e.kind === 'economia').sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({ x: e.date, y: (acc += e.amount) }));
  return (
    <>
      <Panel title="Este mês (dados reais)">
        <div className="stat-tiles" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="tile"><b style={{ fontSize: '1rem' }}>{fmtMoney(sum('renda'))}</b><span>RENDA</span></div>
          <div className="tile"><b style={{ fontSize: '1rem' }}>{fmtMoney(sum('gasto'))}</b><span>GASTOS</span></div>
          <div className="tile"><b style={{ fontSize: '1rem', color: 'var(--gold)' }}>{fmtMoney(sum('economia'))}</b><span>GUARDADO</span></div>
        </div>
      </Panel>
      <Panel title="Registrar">
        <div className="row gap wrap">
          <label className="field" style={{ width: 130 }}>Valor (R$)<input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="field grow">Tipo<select value={kind} onChange={(e) => setKind(e.target.value as never)}><option value="economia">Economia (guardei)</option><option value="gasto">Gasto</option><option value="renda">Renda</option></select></label>
        </div>
        {kind === 'economia' && s.finance.goals.length > 0 && <label className="field">Meta<select value={goalId} onChange={(e) => setGoalId(e.target.value)}><option value="">Sem meta</option>{s.finance.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>}
        <input type="text" placeholder="Descrição" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn primary" style={{ marginTop: 8 }} disabled={!(Number(amount) > 0)} onClick={() => { act((d, ev) => addFinanceEntry(d, ev, { date: dayKey(), amount: Number(amount), kind, goalId: goalId || undefined, note })); setAmount(''); setNote(''); }}>Registrar</button>
      </Panel>
      <Panel title="Metas">
        {s.finance.goals.map((g) => { const sv = financeSaved(s, g.id); return (
          <div key={g.id} style={{ marginBottom: 10 }}><div className="row between"><b>{g.name}</b><span className="mono small">{fmtMoney(sv)} / {fmtMoney(g.target)}</span></div><MiniBar value={sv} max={g.target} color="#ffd166" />{sv >= g.target && <p className="small" style={{ color: 'var(--gold)' }}>Meta alcançada!</p>}</div>
        ); })}
        <div className="row gap wrap"><input type="text" placeholder="Nome da meta" value={gName} onChange={(e) => setGName(e.target.value)} style={{ flex: 2, minWidth: 140 }} /><input type="number" placeholder="Valor" value={gTarget} onChange={(e) => setGTarget(e.target.value)} style={{ flex: 1, minWidth: 90 }} /><button className="btn" onClick={() => { act((d, ev) => addFinanceGoal(d, ev, gName, Number(gTarget))); setGName(''); setGTarget(''); }}>Criar meta</button></div>
      </Panel>
      <Panel title="Total guardado ao longo do tempo"><LineChart series={[{ name: 'Guardado', color: '#ffd166', points: savedSeries }]} /></Panel>
      <Panel title="Últimos registros">
        {[...s.finance.entries].reverse().slice(0, 15).map((e) => <div key={e.id} className="row between small" style={{ padding: '3px 0' }}><span>{e.date.split('-').reverse().slice(0, 2).join('/')} · {e.note || e.kind}</span><span className="mono" style={{ color: e.kind === 'gasto' ? 'var(--bad)' : e.kind === 'economia' ? 'var(--gold)' : 'var(--good)' }}>{e.kind === 'gasto' ? '-' : '+'}{fmtMoney(e.amount)}</span></div>)}
        {!s.finance.entries.length && <p className="small muted">Nenhum registro.</p>}
      </Panel>
    </>
  );
}

const SC: { kind: SelfCareLog['kind']; label: string; unit: string; def: number }[] = [
  { kind: 'sono', label: 'Sono', unit: 'h', def: 7.5 }, { kind: 'agua', label: 'Água', unit: 'L', def: 2 }, { kind: 'alimentacao', label: 'Alimentação boa', unit: 'refeições', def: 3 },
  { kind: 'higiene', label: 'Cuidados pessoais', unit: '✓', def: 1 }, { kind: 'descanso', label: 'Descanso/lazer', unit: 'min', def: 30 }, { kind: 'meditacao', label: 'Meditação', unit: 'min', def: 10 },
];

function SelfCare() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const today = dayKey();
  const [vals, setVals] = useState<Record<string, number>>(Object.fromEntries(SC.map((x) => [x.kind, x.def])));
  const sleep = s.selfcare.filter((x) => x.kind === 'sono').map((x) => ({ x: x.date, y: x.value })).sort((a, b) => a.x.localeCompare(b.x)).slice(-30);
  return (
    <>
      <Panel title="Hoje">
        {SC.map((x) => {
          const done = s.selfcare.some((l) => l.date === today && l.kind === x.kind);
          return (
            <div key={x.kind} className="row gap" style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className="grow">{x.label}</span>
              {x.unit !== '✓' && <input type="number" step={0.5} min={0} value={vals[x.kind]} onChange={(e) => setVals({ ...vals, [x.kind]: Number(e.target.value) })} style={{ width: 80 }} />}
              <span className="small muted" style={{ width: 64 }}>{x.unit !== '✓' ? x.unit : ''}</span>
              <button className={`btn small ${done ? 'good' : ''}`} disabled={done} onClick={() => act((d, ev) => addSelfCare(d, ev, { date: today, kind: x.kind, value: vals[x.kind], note: '' }))}>{done ? '✓' : 'Registrar'}</button>
            </div>
          );
        })}
      </Panel>
      <Panel title="Sono (horas)"><LineChart series={[{ name: 'Sono', color: '#a29bfe', points: sleep }]} unit="h" /></Panel>
    </>
  );
}
