import { useMemo, useState } from 'react';
import { useGame } from '../store/game';
import type { AttrWeights, Difficulty, Mission, MissionType, Recurrence } from '../core/types';
import { MISSION_TYPES } from '../core/types';
import { cancelMission, completeMission, createMission, deleteMission, editMission, effectiveStreak, isDoneThisPeriod, postponeMission, toggleStep } from '../core/engine';
import { TYPE_LABEL, missionXp, stepXp } from '../core/progression';
import { ATTRS } from '../data/attributes';
import { AttrPicker, Modal, Panel, Tabs } from './components';
import { dayKey } from '../core/util';

export const TYPE_COLOR: Record<MissionType, string> = { rapida: '#5fd38d', principal: '#4cc9ff', secundaria: '#8b97b5', dominio: '#ffb547', epica: '#c06bff', lendaria: '#ff4d8d', surpresa: '#ffd166' };
const REC_LABEL: Record<Recurrence, string> = { unica: 'Única', diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };

export function MissionCard({ m, compact = false }: { m: Mission; compact?: boolean }) {
  const act = useGame((x) => x.act);
  const s = useGame((x) => x.s);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const done = isDoneThisPeriod(m);
  const streak = effectiveStreak(s);
  const xp = missionXp(m.type, m.difficulty, streak, m.steps.length);
  const today = dayKey();
  const overdue = m.deadline && m.deadline < today && !done;
  const boss = m.bossId ? s.bosses.find((b) => b.id === m.bossId) : undefined;
  const stepsDone = m.steps.filter((x) => x.done).length;
  return (
    <div className={`mission ${done ? 'done' : ''}`} style={{ '--mc': TYPE_COLOR[m.type] } as React.CSSProperties} data-testid="mission">
      <div className="grow" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
        <div className="mtitle">{m.title}</div>
        <div className="meta">
          <span className="chip" style={{ color: TYPE_COLOR[m.type], borderColor: TYPE_COLOR[m.type] }}>{TYPE_LABEL[m.type]}</span>
          <span className="chip">D{m.difficulty}</span>
          <span className="chip mono">+{xp.total} XP{m.steps.length ? ' final' : ''}</span>
          {m.recurrence !== 'unica' && <span className="chip">{REC_LABEL[m.recurrence]}</span>}
          {m.deadline && <span className="chip" style={overdue ? { color: 'var(--warn)', borderColor: 'var(--warn)' } : undefined}>{m.deadline === today ? 'Hoje' : m.deadline.split('-').reverse().slice(0, 2).join('/')}</span>}
          {m.steps.length > 0 && <span className="chip">{stepsDone}/{m.steps.length} etapas</span>}
          {m.optional && <span className="chip">opcional</span>}
          {boss && !compact && <span className="chip" style={{ color: '#ff8aa8' }}>⚔ {boss.name}</span>}
        </div>
        {(open || (!compact && m.steps.length > 0 && !done)) && m.steps.length > 0 && (
          <ul className="steps" onClick={(e) => e.stopPropagation()}>
            {m.steps.map((st) => (
              <li key={st.id} className={st.done ? 'done' : ''} onClick={() => act((d, ev) => toggleStep(d, ev, m.id, st.id))}>
                <span className={`box ${st.done ? 'on' : ''}`}>{st.done ? '✓' : ''}</span><span>{st.title}</span>
                {!st.done && <small className="muted mono">+{stepXp(m.type, m.difficulty, m.steps.length)}</small>}
              </li>
            ))}
          </ul>
        )}
        {open && (
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
            {m.description && <p className="small">{m.description}</p>}
            <p className="small muted">Desenvolve: {Object.entries(m.attrs).map(([k, w]) => `${ATTRS[k as keyof typeof ATTRS].name} ×${w}`).join(', ')}</p>
            <p className="small muted">XP: base {xp.base} + bônus de sequência {xp.bonus}{m.steps.length ? ` · cada etapa +${stepXp(m.type, m.difficulty, m.steps.length)}` : ''}</p>
            <div className="row wrap gap" style={{ marginTop: 6 }}>
              <button className="btn small" onClick={() => setEdit(true)}>Editar</button>
              {m.status === 'ativa' && m.recurrence === 'unica' && <><button className="btn small" onClick={() => act((d) => postponeMission(d, m.id, 1))}>Adiar 1 dia</button><button className="btn small" onClick={() => act((d) => postponeMission(d, m.id, 7))}>Adiar 1 semana</button></>}
              {m.status === 'ativa' && <button className="btn small danger" onClick={() => { if (confirm('Cancelar esta missão? Ela ficará no histórico.')) act((d) => cancelMission(d, m.id)); }}>Cancelar</button>}
              {m.status !== 'ativa' && <button className="btn small danger" onClick={() => { if (confirm('Excluir permanentemente? O XP já ganho permanece.')) act((d) => deleteMission(d, m.id)); }}>Excluir</button>}
            </div>
            <details style={{ marginTop: 8 }}><summary className="small muted">Histórico ({m.history.filter((h) => !h.event.startsWith('Período:')).length})</summary>
              <ul className="small muted">{m.history.filter((h) => !h.event.startsWith('Período:')).slice(-10).reverse().map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('pt-BR')} — {h.event}</li>)}</ul>
            </details>
          </div>
        )}
      </div>
      {m.status === 'ativa' && (
        <button className={`complete-btn ${done ? 'ok' : ''}`} aria-label={done ? 'Concluída' : 'Concluir missão'} disabled={done}
          onClick={() => act((d, ev) => completeMission(d, ev, m.id))}>{done ? '✓' : '◇'}</button>
      )}
      {edit && <MissionEditor mission={m} onClose={() => setEdit(false)} />}
    </div>
  );
}

export function MissionEditor({ mission, onClose, preset }: { mission?: Mission; onClose: () => void; preset?: Partial<Mission> }) {
  const act = useGame((x) => x.act);
  const [title, setTitle] = useState(mission?.title ?? preset?.title ?? '');
  const [description, setDescription] = useState(mission?.description ?? '');
  const [type, setType] = useState<MissionType>(mission?.type ?? preset?.type ?? 'principal');
  const [difficulty, setDifficulty] = useState<Difficulty>(mission?.difficulty ?? 2);
  const [recurrence, setRecurrence] = useState<Recurrence>(mission?.recurrence ?? 'unica');
  const [attrs, setAttrs] = useState<AttrWeights>(mission?.attrs ?? preset?.attrs ?? {});
  const [deadline, setDeadline] = useState(mission?.deadline ?? (recurrence === 'unica' ? dayKey() : ''));
  const [steps, setSteps] = useState<string[]>(mission?.steps.map((x) => x.title) ?? []);
  const [stepText, setStepText] = useState('');
  const [error, setError] = useState('');
  const xp = missionXp(type, difficulty, 0, steps.length);

  const save = () => {
    const input = { title, description, type, difficulty, recurrence, attrs, deadline: deadline || undefined, steps };
    const ev = act((d, e) => { if (mission) editMission(d, e, mission.id, input); else createMission(d, e, input); });
    const err = ev.find((e) => e.kind === 'error');
    if (err && err.kind === 'error') setError(err.text); else onClose();
  };

  return (
    <Modal onClose={onClose} title={mission ? 'Editar missão' : 'Nova missão'}>
      <label className="field">Nome<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Estudar SQL por 30 min" maxLength={90} aria-label="Nome da missão" /></label>
      <label className="field">Descrição / critério de conclusão<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Como você sabe que terminou?" /></label>
      <label className="field">Tipo
        <select value={type} onChange={(e) => setType(e.target.value as MissionType)} aria-label="Tipo">
          {MISSION_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <div className="row gap">
        <label className="field grow">Dificuldade
          <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as Difficulty)} aria-label="Dificuldade">
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} — {['Trivial', 'Fácil', 'Média', 'Difícil', 'Extrema'][d - 1]}</option>)}
          </select>
        </label>
        <label className="field grow">Repetição
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} aria-label="Repetição">
            {(['unica', 'diaria', 'semanal', 'mensal'] as Recurrence[]).map((r) => <option key={r} value={r}>{REC_LABEL[r]}</option>)}
          </select>
        </label>
      </div>
      <label className="field">Prazo (opcional)<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
      <div className="field">Atributos que desenvolve (até 3; toque de novo para aumentar o peso)<AttrPicker value={attrs} onChange={setAttrs} /></div>
      <div className="field">Etapas (opcional)
        <div className="row gap"><input type="text" value={stepText} onChange={(e) => setStepText(e.target.value)} placeholder="Adicionar etapa" onKeyDown={(e) => { if (e.key === 'Enter' && stepText.trim()) { setSteps([...steps, stepText.trim()]); setStepText(''); } }} /><button className="btn" onClick={() => { if (stepText.trim()) { setSteps([...steps, stepText.trim()]); setStepText(''); } }}>+</button></div>
        <ul className="steps">{steps.map((st, i) => <li key={i}><span>{i + 1}. {st}</span><button className="chip" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>✕</button></li>)}</ul>
      </div>
      <p className="small muted mono">Recompensa prevista: {xp.total} XP na conclusão{steps.length ? ` + ${stepXp(type, difficulty, steps.length)} por etapa` : ''} (+ bônus de sequência).</p>
      {error && <p style={{ color: 'var(--bad)' }} role="alert">{error}</p>}
      <div className="row gap" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></div>
    </Modal>
  );
}

export function MissionsScreen() {
  const s = useGame((x) => x.s);
  const act = useGame((x) => x.act);
  const [tab, setTab] = useState<'hoje' | 'todas' | 'recorrentes' | 'concluidas'>('hoje');
  const [creating, setCreating] = useState(false);
  const today = dayKey();
  const list = useMemo(() => {
    const active = s.missions.filter((m) => m.status === 'ativa');
    if (tab === 'hoje') return active.filter((m) => (m.recurrence !== 'unica' && m.recurrence !== 'mensal') || !m.deadline || m.deadline <= today).sort((a, b) => Number(isDoneThisPeriod(a)) - Number(isDoneThisPeriod(b)));
    if (tab === 'recorrentes') return active.filter((m) => m.recurrence !== 'unica');
    if (tab === 'concluidas') return s.missions.filter((m) => m.status !== 'ativa').sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt)).slice(0, 60);
    return active.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  }, [s.missions, tab, today]);
  const dueToday = s.missions.filter((m) => m.status === 'ativa' && !isDoneThisPeriod(m) && (m.recurrence === 'diaria' || (m.deadline && m.deadline <= today))).length;

  return (
    <div className="screen-inner">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h1 style={{ margin: 0 }}>Missões</h1>
        <button className="btn primary" onClick={() => setCreating(true)} data-testid="new-mission">+ Nova missão</button>
      </div>
      <Panel title="Seu dia" right={<span className="muted small">{dueToday} pendente(s)</span>}>
        <div className="row gap wrap">
          <label className="field grow" style={{ margin: 0 }}>Energia hoje
            <select value={s.settings.energy ?? ''} onChange={(e) => act((d) => { d.settings.energy = (e.target.value || undefined) as never; })}>
              <option value="">Não informar</option><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option>
            </select>
          </label>
          <label className="field grow" style={{ margin: 0 }}>Minutos livres hoje
            <input type="number" min={0} max={1440} value={s.settings.availableMinutes ?? ''} onChange={(e) => act((d) => { d.settings.availableMinutes = e.target.value ? Number(e.target.value) : undefined; })} />
          </label>
        </div>
        {s.settings.energy === 'baixa' && <p className="small" style={{ marginTop: 8, color: 'var(--warn)' }}>Energia baixa: foque nas missões rápidas e na principal mais importante. O resto pode esperar — sem penalidade.</p>}
        {dueToday > s.settings.dailyCapacity && <button className="btn small" style={{ marginTop: 8 }} onClick={() => act((d) => {
          const extra = d.missions.filter((m) => m.status === 'ativa' && m.recurrence === 'unica' && m.deadline && m.deadline <= today && !['principal', 'dominio'].includes(m.type));
          extra.slice(0, Math.max(0, dueToday - d.settings.dailyCapacity)).forEach((m) => postponeMission(d, m.id, 1));
        })}>Reorganizar: adiar secundárias excedentes</button>}
      </Panel>
      <Tabs value={tab} onChange={setTab} options={[['hoje', 'Hoje'], ['todas', 'Todas ativas'], ['recorrentes', 'Recorrentes'], ['concluidas', 'Histórico']]} />
      {list.length === 0 && <p className="muted center" style={{ padding: 30 }}>{tab === 'hoje' ? 'Nada pendente para hoje. Crie uma missão ou uma campanha no Mundo.' : 'Nenhuma missão aqui.'}</p>}
      {list.map((m) => <MissionCard key={m.id} m={m} />)}
      {creating && <MissionEditor onClose={() => setCreating(false)} />}
    </div>
  );
}
