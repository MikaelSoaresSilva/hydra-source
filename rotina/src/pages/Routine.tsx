import { useState } from 'react';
import { useApp } from '../data/AppContext';
import { CATEGORY_HINT, uid } from '../domain/defaults';
import { normBed, sleepMinutes } from '../domain/scheduler';
import { durationLabel, hm, parseHM, spanMinutes, WEEKDAY_SHORT } from '../domain/time';
import { PRIORITY_LABEL, type Activity, type Category, type SleepWindow, type State } from '../domain/types';
import { Card, Chips, Modal } from '../ui/components';
import { isLunchActivity, isWorkActivity, linkWorkLunch } from '../domain/migrate';
import { anchorLabel, anchorSortKey } from '../domain/work';
import { ActivityForm, newActivity } from './ActivityForm';

const daysText = (d: number[]) => d.length === 7 ? 'Todos os dias' : d.join() === '1,2,3,4,5' ? 'Seg–Sex' : d.join() === '0,6' ? 'Fim de semana' : [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => WEEKDAY_SHORT[x]).join(', ');
export function Routine() {
  const { state, update, toast } = useApp();
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<{ a: Activity; isNew: boolean } | null>(null);
  const [catEdit, setCatEdit] = useState<Category | null>(null);
  const list = state.activities.filter((a) => cat === 'all' || a.categoryId === cat)
    .sort((a, b) => sortKey(a) - sortKey(b));
  function sortKey(a: Activity) { return anchorSortKey(a, state.activities); }

  return (
    <div className="stack">
      <div><span className="kicker">Personalização</span><h1>Sua rotina</h1><p className="muted" style={{ margin: 0 }}>Edite qualquer atividade, horário, dia da semana e prioridade. O app reencaixa o resto sozinho, sem conflitos.</p></div>

      <SleepCard />

      <WorkLunchCard />

      <StudyDaysCard />

      <Card title="Categorias" action={<button className="btn sm" onClick={() => setCatEdit({ id: uid(), name: '', emoji: '⭐', color: '#a78bfa' })}>➕ Nova</button>}>
        <div className="chips scroll-x">
          <button className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Todas ({state.activities.length})</button>
          {state.categories.map((c) => (
            <button key={c.id} className={`chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)} onDoubleClick={() => setCatEdit(c)}>
              {c.emoji} {c.name} ({state.activities.filter((a) => a.categoryId === c.id).length})
            </button>
          ))}
        </div>
        {cat !== 'all' && (
          <div className="row between" style={{ marginTop: 8 }}>
            <small>{CATEGORY_HINT[cat] ?? 'Categoria personalizada'}</small>
            <button className="btn ghost sm" onClick={() => setCatEdit(state.categories.find((c) => c.id === cat)!)}>Editar categoria</button>
          </div>
        )}
      </Card>

      <Card title={`Atividades (${list.length})`} action={<button className="btn primary sm" onClick={() => setEdit({ a: newActivity(cat === 'all' ? 'life' : cat), isNew: true })}>➕ Adicionar</button>}>
        <ul className="list">
          {list.map((a) => {
            const c = state.categories.find((x) => x.id === a.categoryId);
            return (
              <li key={a.id} style={{ borderLeft: `4px solid ${c?.color ?? 'var(--accent)'}`, opacity: a.paused ? 0.55 : 1 }}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{c?.emoji} {a.title}</strong>{a.paused && <span className="pill" style={{ marginLeft: 6 }}>pausada</span>}
                    {a.join && <><br /><small>🔗 junto com <strong>{state.activities.find((x) => x.id === a.join!.parentId)?.title ?? '—'}</strong>: {hm(a.join.at)}–{hm(a.join.at + a.join.duration)} nesses dias; nos outros:</small></>}
                    <br /><small>{anchorLabel(a, state.activities)}{a.kind === 'normal' ? ` · ${durationLabel(a.duration)}` : ''} · {daysText(a.days)} · {a.optional ? 'Opcional' : PRIORITY_LABEL[a.priority]}{a.focusDays?.length ? ` · prioridade máxima: ${[1, 2, 3, 4, 5, 6, 0].filter((d) => a.focusDays!.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ')}` : ''}{a.minDuration ? ` · encurta até ${a.minDuration} min` : ''}{a.notify ? ' · 🔔' : ''}</small>
                  </div>
                  <div className="row" style={{ gap: 6, flex: 'none' }}>
                    {a.kind === 'normal' && <button className="btn ghost sm" aria-label={`${a.paused ? 'Retomar' : 'Pausar'} ${a.title}`} onClick={() => { update((s) => ({ ...s, activities: s.activities.map((x) => x.id === a.id ? { ...x, paused: !x.paused } : x) })); toast(a.paused ? `▶️ ${a.title} retomada` : `⏸️ ${a.title} pausada`); }}>{a.paused ? '▶️' : '⏸️'}</button>}
                    <button className="btn sm" aria-label={`Editar ${a.title}`} onClick={() => setEdit({ a, isNew: false })}>Editar</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {!list.length && <p className="empty">Nenhuma atividade nesta categoria.</p>}
      </Card>

      <Card title="Restaurar">
        <p className="muted" style={{ marginTop: 0 }}>Volta para a rotina inicial (o histórico de XP e conquistas continua).</p>
        <button className="btn danger sm" onClick={async () => {
          if (!confirm('Substituir todas as atividades pela rotina inicial?')) return;
          const { defaultActivities } = await import('../domain/defaults');
          update((s) => ({ ...s, activities: defaultActivities(), overrides: {} }));
          toast('Rotina inicial restaurada');
        }}>Restaurar rotina inicial</button>
      </Card>

      {edit && <ActivityForm initial={edit.a} isNew={edit.isNew} onClose={() => setEdit(null)} />}
      {catEdit && <CategoryForm initial={catEdit} onClose={() => setCatEdit(null)} />}
    </div>
  );
}

function SleepCard() {
  const { state, update, toast } = useApp();
  const [type, setType] = useState<'weekday' | 'weekend'>('weekday');
  const w = state.sleep[type];
  const sleep = sleepMinutes(normBed(w), w.wake);
  const ok = sleep >= state.sleep.goalMin && sleep <= state.sleep.goalMax;
  function set(patch: Partial<SleepWindow>) {
    update((s) => ({ ...s, sleep: { ...s.sleep, [type]: { ...s.sleep[type], ...patch } } }));
  }
  function ideal() {
    // Dormir para ter 8 h 30 min de sono a partir do horário de acordar.
    set({ bed: ((w.wake - 510) % 1440 + 1440) % 1440 });
    toast('🌙 Horário de dormir ajustado para 8 h 30 de sono');
  }
  return (
    <Card title="🌙 Sono">
      <Chips label="Tipo de dia" value={type} onChange={setType} options={[{ value: 'weekday', label: 'Dias de semana' }, { value: 'weekend', label: 'Fim de semana' }]} />
      <div className="grid2" style={{ marginTop: 10 }}>
        <label className="field">Acordar<input type="time" aria-label={`Acordar (${type === 'weekday' ? 'semana' : 'fim de semana'})`} value={hm(w.wake)} onChange={(e) => { const v = parseHM(e.target.value); if (v !== null) set({ wake: v }); }} /></label>
        <label className="field">Dormir<input type="time" aria-label={`Dormir (${type === 'weekday' ? 'semana' : 'fim de semana'})`} value={hm(w.bed)} onChange={(e) => { const v = parseHM(e.target.value); if (v !== null) set({ bed: v }); }} /></label>
      </div>
      <div className={`banner ${ok ? 'ok' : 'warn'}`} style={{ marginTop: 10 }}>
        Sono: <strong>{durationLabel(sleep)}</strong> {ok ? '✓ dentro da meta de 8–9 h.' : sleep < state.sleep.goalMin ? '— abaixo da meta de 8 h.' : '— acima de 9 h.'}
        {' '}Desacelerar começa às {hm(normBed(w) - 30)}.
      </div>
      {!ok && <button className="btn sm" style={{ marginTop: 8 }} onClick={ideal}>Ajustar dormir para 8 h 30 de sono</button>}
      <p className="muted" style={{ marginBottom: 0 }}><small>Rotina da manhã, skincare noturno e "Preparar para dormir" acompanham estes horários automaticamente.</small></p>
    </Card>
  );
}

function CategoryForm({ initial, onClose }: { initial: Category; onClose: () => void }) {
  const { state, update, toast } = useApp();
  const [c, setC] = useState(initial);
  const exists = state.categories.some((x) => x.id === c.id);
  const used = state.activities.filter((a) => a.categoryId === c.id).length;
  return (
    <Modal title={exists ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <div className="stack">
        <label className="field">Nome<input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Ex.: FINANÇAS" /></label>
        <div className="grid2">
          <label className="field">Emoji<input value={c.emoji} maxLength={4} onChange={(e) => setC({ ...c, emoji: e.target.value })} /></label>
          <label className="field">Cor<input type="color" value={c.color} onChange={(e) => setC({ ...c, color: e.target.value })} style={{ padding: 4 }} /></label>
        </div>
        <button className="btn primary" disabled={!c.name.trim()} onClick={() => {
          const final = { ...c, name: c.name.trim() };
          update((s) => ({ ...s, categories: exists ? s.categories.map((x) => (x.id === c.id ? final : x)) : [...s.categories, final] }));
          toast('💾 Categoria salva'); onClose();
        }}>Salvar</button>
        {exists && !c.builtin && (
          <button className="btn danger" disabled={used > 0} onClick={() => { update((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) })); toast('Categoria excluída'); onClose(); }}>
            {used > 0 ? `Excluir (mova as ${used} atividades antes)` : 'Excluir categoria'}
          </button>
        )}
      </div>
    </Modal>
  );
}

function WorkLunchCard() {
  const { state, update, toast } = useApp();
  const wl = state.profile.workLunch;
  const work = state.activities.find(isWorkActivity);
  const lunch = state.activities.find(isLunchActivity);
  const linked = !!(work && lunch?.join?.parentId === work.id);
  const wAt = work?.anchor.type === 'time' ? work.anchor.at : 8 * 60;
  const [wStart, setWStart] = useState(hm(wAt));
  const [wEnd, setWEnd] = useState(hm(wAt + (work?.duration ?? 9 * 60)));
  const [commute, setCommute] = useState(String(state.profile.commuteMin ?? 0));
  const [start, setStart] = useState(hm(wl.at));
  const [end, setEnd] = useState(hm(wl.at + wl.duration));
  const span = (() => { const a = parseHM(wStart); const b = parseHM(wEnd); return a !== null && b !== null ? spanMinutes(a, b) : 0; })();
  function apply() {
    const at = parseHM(start); const en = parseHM(end);
    if (at === null || en === null || en - at < 10) { toast('Horário de almoço inválido'); return; }
    const ws = parseHM(wStart);
    if (work && (ws === null || span < 60)) { toast('Horário de trabalho inválido (mínimo 1 h)'); return; }
    const c = Math.max(0, Math.min(180, Math.round(Number(commute.replace(',', '.')) || 0)));
    let msg = '';
    update((s) => {
      let next: State = {
        ...s,
        profile: { ...s.profile, workLunch: { at, duration: en - at }, commuteMin: c },
        activities: work && ws !== null ? s.activities.map((x) => (x.id === work.id ? { ...x, anchor: { type: 'time', at: ws }, duration: span, fixed: true } : x)) : s.activities,
      };
      const r = linkWorkLunch(next);
      next = r.state;
      msg = r.linked ? '💾 Trabalho salvo: o resto da rotina foi reorganizado.' : `💾 Salvo. ${r.reason ?? ''}`;
      return next;
    });
    setTimeout(() => toast(msg), 0);
  }
  return (
    <Card title="💼 Trabalho e almoço">
      <p className="muted" style={{ marginTop: 0 }}><small>Mude o horário do trabalho aqui (ou em qualquer lugar do app) e o resto acompanha: o horário de acordar (e o de dormir, mantendo as horas de sono), o almoço dentro do expediente, o deslocamento e o que vem depois (academia, banho, jantar…). Nos dias sem trabalho, tudo volta ao normal.</small></p>
      {work && (
        <div className="grid2">
          <label className="field">Trabalho — início<input type="time" aria-label="Trabalho início" value={wStart} onChange={(e) => setWStart(e.target.value)} /></label>
          <label className="field">Término<input type="time" aria-label="Trabalho término" value={wEnd} onChange={(e) => setWEnd(e.target.value)} /></label>
        </div>
      )}
      <label className="field" style={{ marginTop: 8 }}>Deslocamento até o trabalho (min, cada trecho; 0 = nenhum)
        <input type="number" inputMode="numeric" min={0} max={180} aria-label="Deslocamento até o trabalho" value={commute} onChange={(e) => setCommute(e.target.value)} />
      </label>
      <div className="grid2" style={{ marginTop: 8 }}>
        <label className="field">Almoço do trabalho — início<input type="time" aria-label="Almoço do trabalho início" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field">Término<input type="time" aria-label="Almoço do trabalho término" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <div className={`banner ${linked ? 'ok' : 'warn'}`} style={{ marginTop: 10 }} data-testid="work-lunch-status">
        {linked && work && lunch?.join
          ? <>✓ Almoço junto com <strong>{work.title}</strong> ({work.anchor.type === 'time' ? `${hm(work.anchor.at)}–${hm(work.anchor.at + work.duration)}` : ''}): {hm(lunch.join.at)}–{hm(lunch.join.at + lunch.join.duration)}.</>
          : work ? <>O almoço ainda não está junto com {work.title}. Toque em "Salvar trabalho e almoço".</> : <>Ainda não há atividade de Trabalho. Adicione uma (ex.: "Trabalho" 08:00–17:00, Seg–Sex) ou escreva na aba IA "vou trabalhar das 8h às 17h" — o resto da rotina se ajusta sozinho.</>}
      </div>
      <button className="btn primary sm" style={{ marginTop: 8 }} onClick={apply}>Salvar trabalho e almoço</button>
    </Card>
  );
}

/** Dias de estudo: nesses dias os estudos viram prioridade máxima (entram junto com academia, refeições e trabalho). */
function StudyDaysCard() {
  const { state, update, toast } = useApp();
  const study = state.activities.find((a) => /^estudos$/i.test(a.title.trim()));
  if (!study) return null;
  const focus = study.focusDays ?? [];
  function toggle(d: number) {
    const next = focus.includes(d) ? focus.filter((x) => x !== d) : [...focus, d].sort();
    update((s) => ({ ...s, activities: s.activities.map((a) => (a.id === study!.id ? { ...a, focusDays: next, days: [...new Set([...a.days, ...next])].sort() } : a)) }));
    toast(focus.includes(d) ? `${WEEKDAY_SHORT[d]}: estudos voltam a ser opcionais` : `${WEEKDAY_SHORT[d]}: dia de estudo (prioridade máxima)`);
  }
  return (
    <Card title="📚 Dias de estudo">
      <p className="muted" style={{ marginTop: 0 }}><small>Nos dias marcados, os estudos entram com prioridade máxima, junto com academia, as 4 refeições e o trabalho (só as refeições e a academia passam na frente). Nos outros dias de semana, os estudos entram só se sobrar espaço. Fim de semana tem o bloco próprio de estudos.</small></p>
      <div className="chips" role="group" aria-label="Dias de estudo">
        {[1, 2, 3, 4, 5].map((d) => <button key={d} type="button" className={`chip ${focus.includes(d) ? 'on' : ''}`} aria-pressed={focus.includes(d)} onClick={() => toggle(d)}>{WEEKDAY_SHORT[d]}</button>)}
      </div>
      <p className="muted" style={{ marginBottom: 0 }}><small>Prioridade máxima nos dias de semana: ⭐ Academia · Café da manhã · Almoço · Lanche da tarde · Jantar · Trabalho{focus.length ? ' · Estudos (nos dias marcados)' : ''}.</small></p>
    </Card>
  );
}
