import { useState } from 'react';
import { useApp } from '../data/AppContext';
import { uid } from '../domain/defaults';
import { durationLabel, hm, parseHM, spanMinutes, WEEKDAY_SHORT } from '../domain/time';
import { PRIORITY_LABEL, type Activity, type Priority, type State } from '../domain/types';
import { Chips, Modal } from '../ui/components';
import { isLunchActivity, isWorkActivity, linkWorkLunch } from '../domain/migrate';

type Timing = 'time' | 'wake' | 'bed';

export function newActivity(categoryId = 'life'): Activity {
  return { id: uid(), title: '', categoryId, description: '', duration: 30, anchor: { type: 'time', at: 15 * 60 }, fixed: false, priority: 2, days: [0, 1, 2, 3, 4, 5, 6], paused: false, notify: true, kind: 'normal' };
}

export function ActivityForm({ initial, onClose, isNew }: { initial: Activity; onClose: () => void; isNew?: boolean }) {
  const { state, update, toast } = useApp();
  const [a, setA] = useState<Activity>(initial);
  const [timeText, setTimeText] = useState(a.anchor.type === 'time' ? hm(a.anchor.at) : '15:00');
  const [endText, setEndText] = useState(hm((a.anchor.type === 'time' ? a.anchor.at : 900) + a.duration));
  const [error, setError] = useState('');
  const special = a.kind === 'wake' || a.kind === 'bed';
  // Fazer junto com outra atividade / unir duas em uma
  const parents = state.activities.filter((x) => x.id !== a.id && x.kind === 'normal' && !x.join);
  const [joinOn, setJoinOn] = useState(!!a.join);
  const [joinParent, setJoinParent] = useState(a.join?.parentId ?? '');
  const [joinStart, setJoinStart] = useState(hm(a.join?.at ?? (a.anchor.type === 'time' ? a.anchor.at : 720)));
  const [joinEnd, setJoinEnd] = useState(hm((a.join?.at ?? (a.anchor.type === 'time' ? a.anchor.at : 720)) + (a.join?.duration ?? a.duration)));
  const [mergeWith, setMergeWith] = useState('');
  const parentOf = (id: string) => state.activities.find((x) => x.id === id);
  const hasChildren = state.activities.some((x) => x.join?.parentId === a.id);

  function merge() {
    const other = parentOf(mergeWith);
    if (!other) return;
    if (!confirm(`Unir "${a.title}" e "${other.title}" numa atividade só? "${other.title}" deixa de existir separada.`)) return;
    const startA = a.anchor.type === 'time' ? a.anchor.at : null;
    const startB = other.anchor.type === 'time' ? other.anchor.at : null;
    const first = startA !== null && startB !== null && startB < startA ? other : a;
    const second = first === a ? other : a;
    const merged: Activity = {
      ...first, id: a.id, title: `${first.title} + ${second.title}`,
      description: [first.description && `${first.title}: ${first.description}`, second.description && `${second.title}: ${second.description}`].filter(Boolean).join('\n'),
      duration: Math.min(16 * 60, first.duration + second.duration),
      days: [...new Set([...first.days, ...second.days])].sort(),
      priority: Math.min(first.priority, second.priority) as Priority,
      notify: first.notify || second.notify, paused: false,
    };
    delete merged.join;
    update((s) => ({
      ...s,
      activities: s.activities.filter((x) => x.id !== other.id).map((x) => (x.id === a.id ? merged : x.join?.parentId === other.id ? { ...x, join: { ...x.join, parentId: a.id } } : x)),
    }));
    toast(`🔗 Unidas: ${merged.title}`);
    onClose();
  }
  const timing: Timing = a.anchor.type;
  const offset = a.anchor.type === 'time' ? 0 : a.anchor.offset;

  function setTiming(t: Timing) {
    if (t === 'time') setEndText(hm((parseHM(timeText) ?? 900) + a.duration));
    setA({ ...a, anchor: t === 'time' ? { type: 'time', at: parseHM(timeText) ?? 900 } : { type: t, offset: t === 'bed' ? Math.max(a.duration, 30) : 30 } });
  }
  function toggleDay(d: number) {
    setA({ ...a, days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d].sort() });
  }

  function save() {
    if (!a.title.trim()) { setError('Dê um nome para a atividade.'); return; }
    if (!special && (a.duration < 5 || a.duration > 16 * 60)) { setError('Duração entre 5 min e 16 h.'); return; }
    if (!a.days.length) { setError('Escolha pelo menos um dia da semana.'); return; }
    if (a.minDuration !== undefined && a.minDuration < 5) { setError('O mínimo para encurtar é 5 min.'); return; }
    let anchor = a.anchor;
    let duration = a.duration;
    if (timing === 'time') {
      const at = parseHM(timeText);
      const end = parseHM(endText);
      if (at === null || end === null) { setError('Início e término precisam estar no formato HH:MM.'); return; }
      duration = spanMinutes(at, end);
      if (duration < 5) { setError('O término precisa ser pelo menos 5 min depois do início.'); return; }
      if (duration > 16 * 60) { setError('Duração máxima de 16 h.'); return; }
      anchor = { type: 'time', at };
    }
    const final: Activity = { ...a, title: a.title.trim(), anchor, duration };
    if (joinOn) {
      const jat = parseHM(joinStart); const jen = parseHM(joinEnd);
      const jd = jat !== null && jen !== null ? spanMinutes(jat, jen) : 0;
      if (!joinParent || jat === null || jd < 5) { setError('Escolha a atividade e um horário válido para "fazer junto".'); return; }
      final.join = { parentId: joinParent, at: jat, duration: jd };
    } else delete final.join;
    let linked = false;
    update((s) => {
      let next: State = { ...s, activities: isNew ? [...s.activities, final] : s.activities.map((x) => (x.id === final.id ? final : x)) };
      // Salvou um Trabalho: o almoço entra junto, no horário de almoço do trabalho.
      if (isWorkActivity(final) && !next.activities.find(isLunchActivity)?.join) { const r = linkWorkLunch(next); next = r.state; linked = r.linked; }
      return next;
    });
    toast(isNew ? `➕ ${final.title} adicionada` : '💾 Atividade salva');
    if (linked) setTimeout(() => toast('🍽️ Almoço colocado junto com o Trabalho'), 1200);
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
              <label className="field">Duração (min)<input type="number" inputMode="numeric" min={5} max={960} value={a.duration} onChange={(e) => {
                const d = Number(e.target.value);
                setA({ ...a, duration: d });
                const st = parseHM(timeText);
                if (st !== null && d > 0) setEndText(hm(st + d));
              }} /></label>
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
              ? <>
                <div className="grid2">
                  <label className="field">Início<input type="time" value={timeText} aria-label="Horário de início" onChange={(e) => {
                    // Mudar o início mantém a duração e empurra o término junto.
                    setTimeText(e.target.value);
                    const st = parseHM(e.target.value);
                    if (st !== null) setEndText(hm(st + a.duration));
                    setA((x) => ({ ...x, fixed: true }));
                  }} /></label>
                  <label className="field">Término<input type="time" value={endText} aria-label="Horário de término" onChange={(e) => {
                    setEndText(e.target.value);
                    const st = parseHM(timeText); const en = parseHM(e.target.value);
                    if (st !== null && en !== null && spanMinutes(st, en) >= 5) setA((x) => ({ ...x, duration: spanMinutes(st, en), fixed: true }));
                  }} /></label>
                </div>
                <small className="muted" data-testid="form-span">{(() => { const st = parseHM(timeText); const en = parseHM(endText); const d = st !== null && en !== null ? spanMinutes(st, en) : 0; return d >= 5 ? `${timeText} até ${endText} · ${durationLabel(d)}${en !== null && st !== null && en < st ? ' (termina no dia seguinte)' : ''}` : 'O término precisa ser depois do início.'; })()}</small>
              </>
              : <label className="field">{timing === 'wake' ? 'Minutos depois de acordar' : 'Começa quantos minutos antes de dormir'}
                <input type="number" inputMode="numeric" min={0} max={900} value={offset} onChange={(e) => setA({ ...a, anchor: { type: timing, offset: Number(e.target.value) } })} /></label>}
            <label className="check"><input type="checkbox" checked={a.fixed} onChange={(e) => setA({ ...a, fixed: e.target.checked })} /> Horário fixo: começa e termina exatamente nos horários escolhidos. Desmarcado: o app encaixa no horário livre mais próximo.</label>
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
        {!special && (
          <details open={joinOn} className="card" style={{ padding: 12, animation: 'none' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>🔗 Combinar com outra atividade</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              {hasChildren ? <p className="muted" style={{ margin: 0 }}><small>Outras atividades já acontecem dentro desta: {state.activities.filter((x) => x.join?.parentId === a.id).map((x) => x.title).join(', ')}.</small></p> : (
                <>
                  <label className="check"><input type="checkbox" checked={joinOn} onChange={(e) => {
                    setJoinOn(e.target.checked);
                    if (e.target.checked && !joinParent) { const w = parents.find(isWorkActivity); if (w) { setJoinParent(w.id); if (isLunchActivity(a)) { setJoinStart(hm(state.profile.workLunch.at)); setJoinEnd(hm(state.profile.workLunch.at + state.profile.workLunch.duration)); } } }
                  }} /> Fazer junto com outra atividade (ao mesmo tempo)</label>
                  {joinOn && (
                    <>
                      <label className="field">Junto com
                        <select aria-label="Junto com" value={joinParent} onChange={(e) => setJoinParent(e.target.value)}>
                          <option value="">Escolha…</option>
                          {parents.map((p) => <option key={p.id} value={p.id}>{p.title}{p.anchor.type === 'time' ? ` (${hm(p.anchor.at)}–${hm(p.anchor.at + p.duration)})` : ''}</option>)}
                        </select>
                      </label>
                      <div className="grid2">
                        <label className="field">Início (junto)<input type="time" aria-label="Início junto" value={joinStart} onChange={(e) => { const old = spanMinutes(parseHM(joinStart) ?? 0, parseHM(joinEnd) ?? 0); setJoinStart(e.target.value); const st = parseHM(e.target.value); if (st !== null && old >= 5) setJoinEnd(hm(st + old)); }} /></label>
                        <label className="field">Término (junto)<input type="time" aria-label="Término junto" value={joinEnd} onChange={(e) => setJoinEnd(e.target.value)} /></label>
                      </div>
                      <small className="muted">Nos dias em que {parentOf(joinParent)?.title ?? 'a outra atividade'} acontece, {a.title || 'esta atividade'} fica dentro dela nesse horário, sem ocupar espaço próprio. Nos outros dias, usa o horário normal acima.</small>
                    </>
                  )}
                </>
              )}
              {!isNew && (
                <>
                  <div className="sep" style={{ margin: '4px 0' }} />
                  <label className="field">Unir numa só atividade com
                    <select aria-label="Unir com" value={mergeWith} onChange={(e) => setMergeWith(e.target.value)}>
                      <option value="">Escolha…</option>
                      {state.activities.filter((x) => x.id !== a.id && x.kind === 'normal').map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn sm" disabled={!mergeWith} onClick={merge}>Unir as duas</button>
                  <small className="muted">Vira uma atividade só: nomes, descrições e durações somados, começando no horário da primeira.</small>
                </>
              )}
            </div>
          </details>
        )}
        {!special && (
          <div className="stack" style={{ gap: 8 }}>
            <label className="check"><input type="checkbox" checked={!!a.optional} onChange={(e) => setA({ ...a, optional: e.target.checked || undefined })} /> Opcional: encaixar só se der (se o dia estiver cheio, fica de fora sem aviso)</label>
            <label className="field">Pode encurtar até (min) — vazio = não encurta
              <input type="number" inputMode="numeric" min={5} max={960} aria-label="Pode encurtar até" value={a.minDuration ?? ''} placeholder="ex.: 30"
                onChange={(e) => { const v = Number(e.target.value); setA({ ...a, minDuration: e.target.value === '' || !v ? undefined : v }); }} />
            </label>
          </div>
        )}
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
