import { useState } from 'react';
import { useApp } from '../data/AppContext';
import { uid } from '../domain/defaults';
import { hm, parseHM, WEEKDAY_SHORT } from '../domain/time';
import { PRIORITY_LABEL, type Activity, type Priority } from '../domain/types';
import { Chips, Modal } from '../ui/components';

type Timing = 'time' | 'wake' | 'bed';

export function newActivity(categoryId = 'life'): Activity {
  return { id: uid(), title: '', categoryId, description: '', duration: 30, anchor: { type: 'time', at: 15 * 60 }, fixed: false, priority: 2, days: [0, 1, 2, 3, 4, 5, 6], paused: false, notify: true, kind: 'normal' };
}

export function ActivityForm({ initial, onClose, isNew }: { initial: Activity; onClose: () => void; isNew?: boolean }) {
  const { state, update, toast } = useApp();
  const [a, setA] = useState<Activity>(initial);
  const [timeText, setTimeText] = useState(a.anchor.type === 'time' ? hm(a.anchor.at) : '15:00');
  const [error, setError] = useState('');
  const special = a.kind === 'wake' || a.kind === 'bed';
  const timing: Timing = a.anchor.type;
  const offset = a.anchor.type === 'time' ? 0 : a.anchor.offset;

  function setTiming(t: Timing) {
    setA({ ...a, anchor: t === 'time' ? { type: 'time', at: parseHM(timeText) ?? 900 } : { type: t, offset: t === 'bed' ? Math.max(a.duration, 30) : 30 } });
  }
  function toggleDay(d: number) {
    setA({ ...a, days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d].sort() });
  }

  function save() {
    if (!a.title.trim()) { setError('Dê um nome para a atividade.'); return; }
    if (!special && (a.duration < 5 || a.duration > 16 * 60)) { setError('Duração entre 5 min e 16 h.'); return; }
    if (!a.days.length) { setError('Escolha pelo menos um dia da semana.'); return; }
    let anchor = a.anchor;
    if (timing === 'time') {
      const at = parseHM(timeText);
      if (at === null) { setError('Horário inválido (use HH:MM).'); return; }
      anchor = { type: 'time', at };
    }
    const final = { ...a, title: a.title.trim(), anchor };
    update((s) => ({ ...s, activities: isNew ? [...s.activities, final] : s.activities.map((x) => (x.id === final.id ? final : x)) }));
    toast(isNew ? `➕ ${final.title} adicionada` : '💾 Atividade salva');
    onClose();
  }

  function remove() {
    if (!confirm(`Excluir "${a.title}" da rotina?`)) return;
    update((s) => ({ ...s, activities: s.activities.filter((x) => x.id !== a.id) }));
    toast('🗑️ Atividade excluída');
    onClose();
  }

  return (
    <Modal title={isNew ? 'Nova atividade' : 'Editar atividade'} onClose={onClose}>
      <div className="stack">
        {error && <div className="banner danger" role="alert">{error}</div>}
        <label className="field">Nome<input value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} placeholder="Ex.: Inglês" disabled={special} /></label>
        <label className="field">Categoria
          <select value={a.categoryId} onChange={(e) => setA({ ...a, categoryId: e.target.value })}>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </label>
        <label className="field">Descrição<textarea value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} placeholder="O que fazer, passo a passo" /></label>
        {special ? (
          <div className="banner">O horário de {a.kind === 'wake' ? 'acordar' : 'dormir'} é definido em Rotina → Sono (dias de semana e fim de semana separados).</div>
        ) : (
          <>
            <div className="grid2">
              <label className="field">Duração (min)<input type="number" inputMode="numeric" min={5} max={960} value={a.duration} onChange={(e) => setA({ ...a, duration: Number(e.target.value) })} /></label>
              <label className="field">Prioridade
                <select value={a.priority} onChange={(e) => setA({ ...a, priority: Number(e.target.value) as Priority })}>
                  {([1, 2, 3] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </label>
            </div>
            <div>
              <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 650 }}>Horário</p>
              <Chips<Timing> label="Tipo de horário" value={timing} onChange={setTiming}
                options={[{ value: 'time', label: 'No relógio' }, { value: 'wake', label: 'Depois de acordar' }, { value: 'bed', label: 'Antes de dormir' }]} />
            </div>
            {timing === 'time'
              ? <label className="field">Começa às<input type="time" value={timeText} onChange={(e) => setTimeText(e.target.value)} aria-label="Horário de início" /></label>
              : <label className="field">{timing === 'wake' ? 'Minutos depois de acordar' : 'Começa quantos minutos antes de dormir'}
                <input type="number" inputMode="numeric" min={0} max={900} value={offset} onChange={(e) => setA({ ...a, anchor: { type: timing, offset: Number(e.target.value) } })} /></label>}
            <label className="check"><input type="checkbox" checked={a.fixed} onChange={(e) => setA({ ...a, fixed: e.target.checked })} /> Horário fixo (não mover). Desmarcado: o app encaixa no horário livre mais próximo.</label>
          </>
        )}
        <div>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: '0.85rem', fontWeight: 650 }}>Dias da semana</p>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" className={`chip ${a.days.includes(d) ? 'on' : ''}`} aria-pressed={a.days.includes(d)} onClick={() => toggleDay(d)}>{WEEKDAY_SHORT[d]}</button>)}
          </div>
          <div className="chips" style={{ marginTop: 6 }}>
            <button type="button" className="chip" onClick={() => setA({ ...a, days: [0, 1, 2, 3, 4, 5, 6] })}>Todos</button>
            <button type="button" className="chip" onClick={() => setA({ ...a, days: [1, 2, 3, 4, 5] })}>Seg–Sex</button>
            <button type="button" className="chip" onClick={() => setA({ ...a, days: [0, 6] })}>Fim de semana</button>
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={a.notify} onChange={(e) => setA({ ...a, notify: e.target.checked })} /> Lembrete com notificação</label>
        {!special && <label className="check"><input type="checkbox" checked={a.paused} onChange={(e) => setA({ ...a, paused: e.target.checked })} /> Pausada (some da rotina até reativar)</label>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={save}>Salvar</button>
          {!isNew && !special && <button className="btn danger" onClick={remove}>Excluir</button>}
        </div>
      </div>
    </Modal>
  );
}
