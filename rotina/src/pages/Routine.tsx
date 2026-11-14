import { useState } from 'react';
import { useApp } from '../data/AppContext';
import { CATEGORY_HINT, uid } from '../domain/defaults';
import { normBed, sleepMinutes } from '../domain/scheduler';
import { durationLabel, hm, parseHM, WEEKDAY_SHORT } from '../domain/time';
import { PRIORITY_LABEL, type Activity, type Category, type SleepWindow } from '../domain/types';
import { Card, Chips, Modal } from '../ui/components';
import { isLunchActivity, isWorkActivity, linkWorkLunch } from '../domain/migrate';
import { ActivityForm, newActivity } from './ActivityForm';

const daysText = (d: number[]) => d.length === 7 ? 'Todos os dias' : d.join() === '1,2,3,4,5' ? 'Seg–Sex' : d.join() === '0,6' ? 'Fim de semana' : [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => WEEKDAY_SHORT[x]).join(', ');
const anchorText = (a: Activity) => a.kind === 'wake' ? 'no horário de acordar' : a.kind === 'bed' ? 'no horário de dormir'
  : a.anchor.type === 'time' ? `${a.fixed ? '' : 'perto de '}${hm(a.anchor.at)}–${hm(a.anchor.at + a.duration)}` : a.anchor.type === 'wake' ? `${a.anchor.offset} min após acordar` : `${a.anchor.offset} min antes de dormir`;

export function Routine() {
  const { state, update, toast } = useApp();
  const [cat, setCat] = useState('all');
  const [edit, setEdit] = useState<{ a: Activity; isNew: boolean } | null>(null);
  const [catEdit, setCatEdit] = useState<Category | null>(null);
  const list = state.activities.filter((a) => cat === 'all' || a.categoryId === cat)
    .sort((a, b) => sortKey(a) - sortKey(b));
  function sortKey(a: Activity) { return a.kind === 'wake' ? -1 : a.kind === 'bed' ? 3000 : a.anchor.type === 'wake' ? a.anchor.offset : a.anchor.type === 'bed' ? 2000 - a.anchor.offset : a.anchor.at; }

  return (
    <div className="stack">
      <div><span className="kicker">Personalização</span><h1>Sua rotina</h1><p className="muted" style={{ margin: 0 }}>Edite qualquer atividade, horário, dia da semana e prioridade. O app reencaixa o resto sozinho, sem conflitos.</p></div>

      <SleepCard />

      <WorkLunchCard />

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
                    <br /><small>{anchorText(a)}{a.kind === 'normal' ? ` · ${durationLabel(a.duration)}` : ''} · {daysText(a.days)} · {PRIORITY_LABEL[a.priority]}{a.notify ? ' · 🔔' : ''}</small>
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
  const [start, setStart] = useState(hm(wl.at));
  const [end, setEnd] = useState(hm(wl.at + wl.duration));
  const work = state.activities.find(isWorkActivity);
  const lunch = state.activities.find(isLunchActivity);
  const linked = !!(work && lunch?.join?.parentId === work.id);
  function apply() {
    const at = parseHM(start); const en = parseHM(end);
    if (at === null || en === null || en - at < 10) { toast('Horário de almoço inválido'); return; }
    let msg = '';
    update((s) => {
      const withLunch = { ...s, profile: { ...s.profile, workLunch: { at, duration: en - at } } };
      const r = linkWorkLunch(withLunch);
      msg = r.linked ? `🍽️ Almoço junto com o Trabalho: ${start}–${end}` : `Horário salvo. ${r.reason ?? ''}`;
      return r.state;
    });
    setTimeout(() => toast(msg), 0);
  }
  return (
    <Card title="💼 Trabalho e almoço">
      <p className="muted" style={{ marginTop: 0 }}><small>Nos dias de trabalho o almoço acontece dentro do horário de trabalho. Nos dias sem trabalho, o almoço volta ao horário normal{lunch && lunch.anchor.type === 'time' ? ` (${hm(lunch.anchor.at)}–${hm(lunch.anchor.at + lunch.duration)})` : ''}.</small></p>
      <div className="grid2">
        <label className="field">Almoço do trabalho — início<input type="time" aria-label="Almoço do trabalho início" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field">Término<input type="time" aria-label="Almoço do trabalho término" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <div className={`banner ${linked ? 'ok' : 'warn'}`} style={{ marginTop: 10 }} data-testid="work-lunch-status">
        {linked && work && lunch?.join
          ? <>✓ Almoço junto com <strong>{work.title}</strong> ({work.anchor.type === 'time' ? `${hm(work.anchor.at)}–${hm(work.anchor.at + work.duration)}` : ''}): {hm(lunch.join.at)}–{hm(lunch.join.at + lunch.join.duration)}.</>
          : work ? <>O almoço ainda não está junto com {work.title}. Toque em "Aplicar".</> : <>Ainda não há atividade de Trabalho. Adicione uma (ex.: "Trabalho" 08:00–17:00, Seg–Sex) ou escreva na aba IA "vou trabalhar das 8h às 17h" — o almoço entra junto automaticamente.</>}
      </div>
      <button className="btn primary sm" style={{ marginTop: 8 }} onClick={apply}>Aplicar</button>
    </Card>
  );
}
