import { useMemo, useState } from 'react';
import { useApp } from '../data/AppContext';
import { uid } from '../domain/defaults';
import { levelInfo, streak, totalXp } from '../domain/progress';
import { buildDay, currentAndNext, isLate, type PlanItem } from '../domain/scheduler';
import { addDays, durationLabel, hm, longDate, pad, parseHM, spanMinutes } from '../domain/time';
import { emptyOverride, type Activity } from '../domain/types';
import { Bar, Card, Chips, Modal, Ring, fmt } from '../ui/components';
import { ActivityForm } from './ActivityForm';

export function Today({ go }: { go: (tab: string) => void }) {
  const { state, day, now, toggle, snooze, update, toast } = useApp();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [menu, setMenu] = useState<PlanItem | null>(null);
  const [timeEdit, setTimeEdit] = useState<PlanItem | null>(null);
  const date = addDays(day.date, offset);
  const isToday = offset === 0;
  const plan = useMemo(() => buildDay(state, date), [state, date]);
  const doneMap = state.completions[date] ?? {};
  const done = new Set(Object.keys(doneMap));
  const total = plan.items.length;
  const doneN = plan.items.filter((i) => done.has(i.activity.id)).length;
  const pct = total ? doneN / total : 0;
  const nowMin = isToday ? day.nowMin : offset < 0 ? 99999 : -1;
  const { current, next } = currentAndNext(plan, nowMin, done);
  const xp = totalXp(state);
  const lv = levelInfo(xp);
  const st = streak(state, day.date);
  const catOf = (id: string) => state.categories.find((c) => c.id === id) ?? { emoji: '•', color: 'var(--accent)', name: '' };
  // Não acusa atraso do que já tinha passado antes de você instalar o app.
  const installedMin = state.createdAt.slice(0, 10) === date ? new Date(state.createdAt).getHours() * 60 + new Date(state.createdAt).getMinutes() : -1;
  const lateOf = (i: PlanItem) => isToday && i.start >= installedMin && isLate(i, nowMin, done.has(i.activity.id), state.settings.lateAfterMin);
  const lateList = plan.items.filter(lateOf);
  const nextIn = next ? next.start - nowMin : 0;

  function skipToday(it: PlanItem) {
    update((s) => {
      const o = structuredClone(s.overrides[date] ?? emptyOverride());
      if (!o.skip.includes(it.activity.id)) o.skip.push(it.activity.id);
      return { ...s, overrides: { ...s.overrides, [date]: o } };
    });
    toast(`⏭️ ${it.activity.title} fora de ${isToday ? 'hoje' : 'deste dia'}; os horários foram reorganizados`);
    setMenu(null);
  }
  function resetDay() {
    update((s) => { const o = { ...s.overrides }; delete o[date]; return { ...s, overrides: o }; });
    toast('↺ Mudanças só deste dia desfeitas');
  }

  return (
    <div className="stack">
      <section className="hero" aria-label="Painel do dia">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <span className="kicker">{isToday ? 'Hoje' : offset === 1 ? 'Amanhã' : offset === -1 ? 'Ontem' : 'Dia'}</span>
            <p style={{ margin: '2px 0 6px', fontWeight: 650 }}>{longDate(date).replace(/^./, (c) => c.toUpperCase())}</p>
            {isToday && <div className="clock" aria-label="Horário atual">{pad(now.getHours())}:{pad(now.getMinutes())}</div>}
          </div>
          <Ring value={pct} size={104} color="grad" label={`Progresso do dia: ${Math.round(pct * 100)}%`}>
            <div><strong data-testid="day-pct">{Math.round(pct * 100)}%</strong><br /><small>{doneN}/{total}</small></div>
          </Ring>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 10 }}>
          <span className="pill gold" title="Nível">⚔️ Nível {lv.level} · {lv.title}</span>
          <span className="pill" data-testid="streak">🔥 {st} {st === 1 ? 'dia' : 'dias'}</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <Bar value={lv.pct} label="XP para o próximo nível" />
          <small>{fmt(lv.into)} / {fmt(lv.need)} XP para o nível {lv.level + 1} · total {fmt(xp)} XP</small>
        </div>
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="stat"><div className="v">{doneN}</div><div className="l">Concluídas</div></div>
          <div className="stat"><div className="v">{total - doneN}</div><div className="l">Pendentes</div></div>
          <div className="stat"><div className="v">{hm(plan.wake)}</div><div className="l">Acordar</div></div>
          <div className="stat"><div className="v">{hm(plan.bed)}</div><div className="l">Dormir</div></div>
          <div className="stat"><div className="v">{Math.floor(plan.sleepMinutes / 60)}h{plan.sleepMinutes % 60 ? String(plan.sleepMinutes % 60).padStart(2, '0') : ''}</div><div className="l">Sono</div></div>
          <div className="stat"><div className="v">{lateList.length}</div><div className="l">Atrasadas</div></div>
        </div>
      </section>

      {isToday && (current || next) && (
        <Card title={current && !done.has(current.activity.id) ? 'Agora' : 'Próxima atividade'} className="accent">
          {current && !done.has(current.activity.id) && (
            <div style={{ marginBottom: next ? 12 : 0 }}>
              <div className="row between"><strong style={{ fontSize: '1.15rem' }}><span className="now-dot" /> {catOf(current.activity.categoryId).emoji} {current.activity.title}</strong><span className="pill violet">até {hm(current.end)}</span></div>
              <Bar thin value={(nowMin - current.start) / Math.max(1, current.end - current.start)} label="Andamento da atividade atual" />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn primary sm" onClick={() => toggle(date, current.activity.id)}>Concluir</button>
                <button className="btn sm" onClick={() => snooze(date, current.activity.id)}>Adiar {state.settings.snoozeMin} min</button>
              </div>
            </div>
          )}
          {next && (
            <div className="row between" data-testid="next-activity">
              <span><small>{current && !done.has(current.activity.id) ? 'Depois:' : 'Próxima:'}</small><br /><strong>{catOf(next.activity.categoryId).emoji} {next.activity.title}</strong></span>
              <span className="pill">{hm(next.start)} · em {nextIn >= 60 ? `${Math.floor(nextIn / 60)} h ${nextIn % 60} min` : `${nextIn} min`}</span>
            </div>
          )}
        </Card>
      )}

      {lateList.length > 0 && (
        <div className="banner danger" role="alert">⚠️ {lateList.length === 1 ? 'Atrasada' : 'Atrasadas'}: {lateList.map((i) => i.activity.title).join(', ')}. Conclua, adie ou tire de hoje.</div>
      )}

      <Card title="Rotina do dia" action={
        <div className="row">
          <button className="icon-btn" aria-label="Dia anterior" onClick={() => setOffset(offset - 1)}>‹</button>
          {!isToday && <button className="btn sm" onClick={() => setOffset(0)}>Hoje</button>}
          <button className="icon-btn" aria-label="Próximo dia" onClick={() => setOffset(offset + 1)}>›</button>
        </div>}>
        {plan.unplaced.length > 0 && <div className="banner warn" style={{ marginBottom: 8 }}>Não couberam: {plan.unplaced.map((u) => `${u.activity.title} (${u.reason})`).join('; ')}. Peça um ajuste na aba IA ou reduza durações.</div>}
        {plan.skipped.length > 0 && (
          <p className="hint" style={{ marginTop: 0 }}><small>Fora deste dia: {plan.skipped.map((a) => a.title).join(', ')}. <button className="btn ghost sm" onClick={resetDay}>Desfazer mudanças do dia</button></small></p>
        )}
        <ul className="tl" aria-label="Linha do tempo">
          {plan.items.map((it) => {
            const c = catOf(it.activity.categoryId);
            const isDone = done.has(it.activity.id);
            const isNow = current?.activity.id === it.activity.id;
            const late = lateOf(it);
            const canCheck = offset <= 0 || it.activity.kind === 'wake';
            return (
              <li key={it.activity.id} className={`tl-item ${isDone ? 'done' : ''} ${isNow && !isDone ? 'now' : ''} ${late ? 'late' : ''}`} style={{ ['--c' as string]: c.color }} data-testid="tl-item">
                <div className="tl-time">{hm(it.start)}<small>{it.end > it.start ? hm(it.end) : ''}</small></div>
                <div className="tl-main" onClick={() => setOpen(open === it.activity.id ? null : it.activity.id)} role="button" tabIndex={0} aria-expanded={open === it.activity.id}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpen(open === it.activity.id ? null : it.activity.id); }}>
                  <div className="tl-title">{c.emoji} {it.activity.title}</div>
                  <small>{it.end > it.start ? durationLabel(it.end - it.start) : 'meta 8–9 h de sono'}{it.todayOnly ? ' · só hoje' : ''}{late ? ' · atrasada' : ''}{isNow && !isDone ? ' · agora' : ''}{state.snoozes[`${date}|${it.activity.id}`] && !isDone ? ' · adiada' : ''}</small>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="icon-btn" aria-label={`Opções de ${it.activity.title}`} onClick={() => setMenu(it)}>⋯</button>
                  <button className={`check-btn ${isDone ? 'on' : ''}`} aria-label={`${isDone ? 'Desmarcar' : 'Concluir'} ${it.activity.title}`} aria-pressed={isDone} disabled={!canCheck} onClick={() => toggle(date, it.activity.id)}>✓</button>
                </div>
                {open === it.activity.id && <div className="tl-desc">{it.activity.description || 'Sem descrição.'}{doneMap[it.activity.id] && <><br /><small>Concluída às {new Date(doneMap[it.activity.id].at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · +{doneMap[it.activity.id].xp} XP{doneMap[it.activity.id].onTime ? ' (no horário)' : ''}</small></>}</div>}
              </li>
            );
          })}
        </ul>
        <div className="row wrap" style={{ marginTop: 12 }}>
          <button className="btn sm" onClick={() => setEdit({ id: uid(), title: '', categoryId: 'life', description: '', duration: 30, anchor: { type: 'time', at: 15 * 60 }, fixed: false, priority: 2, days: [0, 1, 2, 3, 4, 5, 6], paused: false, notify: true, kind: 'normal' })}>➕ Adicionar atividade</button>
          <button className="btn sm" onClick={() => go('ia')}>🤖 Pedir ajuste à IA</button>
        </div>
      </Card>

      <NutritionCard date={date} />

      {menu && (
        <Modal title={menu.activity.title} onClose={() => setMenu(null)}>
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>{hm(menu.start)}–{hm(menu.end)} · {durationLabel(menu.end - menu.start)}</p>
            <button className="btn block" onClick={() => { toggle(date, menu.activity.id); setMenu(null); }}>{done.has(menu.activity.id) ? 'Desmarcar' : '✅ Concluir'}</button>
            {isToday && !done.has(menu.activity.id) && <button className="btn block" onClick={() => { snooze(date, menu.activity.id); setMenu(null); }}>⏰ Adiar lembrete {state.settings.snoozeMin} min</button>}
            {menu.activity.kind === 'normal' && <button className="btn block" onClick={() => { setTimeEdit(menu); setMenu(null); }}>🕒 Mudar início e término</button>}
            {menu.activity.kind === 'normal' && <button className="btn block" onClick={() => skipToday(menu)}>⏭️ Não fazer {isToday ? 'hoje' : 'neste dia'}</button>}
            {!state.overrides[date]?.add.some((x) => x.id === menu.activity.id) && <button className="btn block" onClick={() => { setEdit(state.activities.find((a) => a.id === menu.activity.id) ?? null); setMenu(null); }}>✏️ Editar atividade</button>}
          </div>
        </Modal>
      )}
      {timeEdit && <TimeEdit item={timeEdit} date={date} isToday={isToday} onClose={() => setTimeEdit(null)} />}
      {edit && <ActivityForm initial={edit} isNew={!state.activities.some((a) => a.id === edit.id)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function NutritionCard({ date }: { date: string }) {
  const { state, update } = useApp();
  const [f, setF] = useState({ label: '', kcal: '', protein: '', carbs: '', fat: '' });
  const water = state.water[date] ?? 0;
  const foods = state.food[date] ?? [];
  const tot = foods.reduce((a, x) => ({ kcal: a.kcal + x.kcal, protein: a.protein + x.protein, carbs: a.carbs + x.carbs, fat: a.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const p = state.profile;
  const addWater = (ml: number) => update((s) => ({ ...s, water: { ...s.water, [date]: Math.max(0, (s.water[date] ?? 0) + ml) } }));
  const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
  return (
    <Card title="🍽️ Nutrição do dia">
      <div className="row between"><strong>💧 Água</strong><span data-testid="water">{fmt(water / 1000, 2)} / {fmt(p.waterMl / 1000, 1)} L</span></div>
      <Bar value={water / p.waterMl} label="Meta de água" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={() => addWater(250)}>+ 250 ml</button>
        <button className="btn sm" onClick={() => addWater(500)}>+ 500 ml</button>
        <button className="btn ghost sm" onClick={() => addWater(-250)} disabled={!water}>− 250 ml</button>
      </div>
      <div className="sep" />
      {([['Calorias', tot.kcal, p.kcal, 'kcal'], ['Proteína', tot.protein, p.protein, 'g'], ['Carboidratos', tot.carbs, p.carbs, 'g'], ['Gorduras', tot.fat, p.fat, 'g']] as const).map(([l, v, t, u]) => (
        <div key={l} style={{ marginBottom: 6 }}>
          <div className="row between"><small>{l}</small><small>{fmt(v)} / {t} {u}</small></div>
          <Bar thin value={v / t} label={l} />
        </div>
      ))}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Registrar refeição ({foods.length})</summary>
        <div className="stack" style={{ marginTop: 8 }}>
          <input aria-label="Refeição" placeholder="Ex.: Almoço — arroz, feijão e frango" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <div className="grid2">
            <input aria-label="kcal" inputMode="decimal" placeholder="kcal" value={f.kcal} onChange={(e) => setF({ ...f, kcal: e.target.value })} />
            <input aria-label="Proteína (g)" inputMode="decimal" placeholder="Proteína (g)" value={f.protein} onChange={(e) => setF({ ...f, protein: e.target.value })} />
            <input aria-label="Carboidratos (g)" inputMode="decimal" placeholder="Carboidratos (g)" value={f.carbs} onChange={(e) => setF({ ...f, carbs: e.target.value })} />
            <input aria-label="Gorduras (g)" inputMode="decimal" placeholder="Gorduras (g)" value={f.fat} onChange={(e) => setF({ ...f, fat: e.target.value })} />
          </div>
          <button className="btn sm" disabled={!f.label.trim() || !num(f.kcal)} onClick={() => {
            const e = { id: uid(), label: f.label.trim(), kcal: num(f.kcal), protein: num(f.protein), carbs: num(f.carbs), fat: num(f.fat) };
            update((s) => ({ ...s, food: { ...s.food, [date]: [...(s.food[date] ?? []), e] } }));
            setF({ label: '', kcal: '', protein: '', carbs: '', fat: '' });
          }}>Salvar refeição</button>
          <ul className="list">{foods.map((x) => (
            <li key={x.id} className="row between"><span>{x.label}<br /><small>{fmt(x.kcal)} kcal · P {fmt(x.protein)} · C {fmt(x.carbs)} · G {fmt(x.fat)}</small></span>
              <button className="btn ghost sm" aria-label={`Apagar ${x.label}`} onClick={() => update((s) => ({ ...s, food: { ...s.food, [date]: (s.food[date] ?? []).filter((y) => y.id !== x.id) } }))}>✕</button></li>
          ))}</ul>
        </div>
      </details>
    </Card>
  );
}

/** Início e término de uma atividade: só neste dia ou para todos os dias em que ela acontece. */
function TimeEdit({ item, date, isToday, onClose }: { item: PlanItem; date: string; isToday: boolean; onClose: () => void }) {
  const { state, update, toast } = useApp();
  const [start, setStart] = useState(hm(item.start));
  const [end, setEnd] = useState(hm(item.end));
  const onlyThisDay = state.overrides[date]?.add.some((x) => x.id === item.activity.id) ?? false;
  const [scope, setScope] = useState<'day' | 'always'>('day');
  const st = parseHM(start); const en = parseHM(end);
  const d = st !== null && en !== null ? spanMinutes(st, en) : 0;
  const valid = d >= 5 && d <= 16 * 60;
  // Confere antes de salvar se o novo horário cabe entre acordar e dormir.
  const outside = (() => {
    if (!valid || st === null) return null;
    const o = structuredClone(state.overrides[date] ?? emptyOverride());
    o.move[item.activity.id] = st; o.duration[item.activity.id] = d;
    const u = buildDay({ ...state, overrides: { ...state.overrides, [date]: o } }, date).unplaced.find((x) => x.activity.id === item.activity.id);
    return u ? u.reason : null;
  })();
  function save() {
    if (!valid || st === null) return;
    const id = item.activity.id;
    if (scope === 'day') {
      update((s) => {
        const o = structuredClone(s.overrides[date] ?? emptyOverride());
        o.move[id] = st; o.duration[id] = d;
        return { ...s, overrides: { ...s.overrides, [date]: o } };
      });
    } else {
      update((s) => ({
        ...s,
        activities: s.activities.map((a) => (a.id === id ? { ...a, anchor: { type: 'time', at: st }, duration: d, fixed: true } : a)),
        // remove ajustes só-hoje desta atividade, para valer o novo horário
        overrides: Object.fromEntries(Object.entries(s.overrides).map(([k, o]) => {
          const m = { ...o.move }; const du = { ...o.duration }; delete m[id]; delete du[id];
          return [k, { ...o, move: m, duration: du }];
        })),
      }));
    }
    toast(`🕒 ${item.activity.title}: ${start}–${end}${scope === 'day' ? (isToday ? ' (só hoje)' : ' (só neste dia)') : ''}. O resto foi reorganizado.`);
    onClose();
  }
  return (
    <Modal title={`Horário · ${item.activity.title}`} onClose={onClose}>
      <div className="stack">
        <div className="grid2">
          <label className="field">Início<input type="time" aria-label="Novo início" value={start} onChange={(e) => {
            setStart(e.target.value);
            const s2 = parseHM(e.target.value);
            if (s2 !== null && st !== null && en !== null) setEnd(hm(s2 + spanMinutes(st, en)));
          }} /></label>
          <label className="field">Término<input type="time" aria-label="Novo término" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <small className={valid ? 'muted' : ''} style={valid ? undefined : { color: 'var(--danger)' }}>{valid ? `Duração: ${durationLabel(d)}${en !== null && st !== null && en < st ? ' (termina no dia seguinte)' : ''}` : 'O término precisa ser pelo menos 5 min depois do início (máx. 16 h).'}</small>
        {outside && <div className="banner warn" role="alert">Esse horário fica {outside} ({hm(buildDay(state, date).wake)}–{hm(buildDay(state, date).bed)}). Mude o horário ou ajuste o sono em Rotina → Sono.</div>}
        {!onlyThisDay && <Chips label="Vale para" value={scope} onChange={setScope} options={[{ value: 'day', label: isToday ? 'Só hoje' : 'Só neste dia' }, { value: 'always', label: 'Todos os dias' }]} />}
        <p className="muted" style={{ margin: 0 }}><small>A atividade fica fixa nesse horário e as outras se reorganizam em volta, sem conflito.</small></p>
        <button className="btn primary" disabled={!valid || !!outside} onClick={save}>Salvar horário</button>
      </div>
    </Modal>
  );
}
