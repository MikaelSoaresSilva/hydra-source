// Trabalho conectado: quando o horário do trabalho muda, o resto da rotina acompanha.
// - Manhã: o horário de acordar anda junto com o início do trabalho (dormir acompanha, mesmas horas de sono),
//   e nunca fica tarde demais para a rotina da manhã + o deslocamento caberem antes do expediente.
// - Deslocamento: "Ida para o trabalho" e "Volta para casa" grudadas no Trabalho (se você informar o tempo).
// - Tarde/noite: academia, banho, jantar… são reencaixados pelo montador do dia (encadeadas e flexíveis).
import { linkWorkLunch } from './migrate';
import { norm } from './interpreter';
import { hm } from './time';
import { emptyOverride, type Activity, type SleepWindow, type State } from './types';

export const COMMUTE_IN = 'commute_in';
export const COMMUTE_OUT = 'commute_out';
export const MIN_WAKE = 4 * 60;

export const isWork = (a: Activity) => /^trabalho/.test(norm(a.title)) && a.anchor.type === 'time' && !a.paused && a.id !== COMMUTE_IN && a.id !== COMMUTE_OUT;
export const findWork = (s: State) => s.activities.find(isWork);
const mod = (m: number) => ((m % 1440) + 1440) % 1440;
const r5 = (m: number) => Math.floor(m / 5) * 5;

/** Assinatura do trabalho: muda quando muda horário, duração, dias, deslocamento ou um ajuste "só hoje" dele. */
export function workSignature(s: State): string {
  const w = findWork(s);
  if (!w) return '';
  const dayChanges = Object.entries(s.overrides).filter(([, o]) => w.id in o.move || w.id in o.duration).map(([d, o]) => `${d}:${o.move[w.id] ?? ''}/${o.duration[w.id] ?? ''}`).sort();
  return JSON.stringify([w.id, w.anchor, w.duration, w.days, s.profile.commuteMin, dayChanges]);
}

/** Quanto tempo a rotina da manhã ocupa (do acordar até o fim do último passo "depois de acordar") nos dias de trabalho. */
export function morningSpan(s: State, days: number[]): number {
  let span = 0;
  for (const a of s.activities) {
    if (a.paused || !a.days.some((d) => days.includes(d))) continue;
    if (a.anchor.type === 'wake') span = Math.max(span, a.anchor.offset + a.duration);
  }
  return span;
}

/** Horário mais tarde para acordar e ainda caber a manhã + deslocamento antes do trabalho. */
export function latestWake(s: State, workStart: number, days: number[]): number {
  return r5(workStart - s.profile.commuteMin - morningSpan(s, days));
}

function moveWindow(w: SleepWindow, newWake: number): SleepWindow {
  const delta = newWake - w.wake;
  return { wake: mod(newWake), bed: mod(w.bed + delta) };
}

export interface WorkSync { state: State; notes: string[] }

/**
 * Ajusta a rotina ao trabalho. `prev` = estado antes da mudança (para saber quanto o trabalho andou).
 * Idempotente: rodar de novo sem mudança no trabalho não altera nada.
 */
export function syncWork(prev: State | null, next: State): WorkSync {
  const notes: string[] = [];
  let s: State = structuredClone(next);
  const work = findWork(s);

  // Deslocamento grudado no trabalho.
  const commute = s.profile.commuteMin;
  const legs = s.activities.filter((a) => a.id === COMMUTE_IN || a.id === COMMUTE_OUT);
  if (!work || commute <= 0) {
    if (legs.length) { s.activities = s.activities.filter((a) => a.id !== COMMUTE_IN && a.id !== COMMUTE_OUT); notes.push('Deslocamento removido da rotina.'); }
  } else {
    const leg = (id: string, title: string, side: 'before' | 'after'): Activity => ({
      id, title, categoryId: 'work', description: side === 'before' ? 'Caminho até o trabalho. Bom momento para podcast ou revisar o dia.' : 'Caminho de volta. Desacelere: o resto da rotina começa quando você chega.',
      duration: commute, anchor: { type: 'rel', ids: [work.id], side, gap: 0, fallback: side === 'before' ? (work.anchor as { at: number }).at - commute : (work.anchor as { at: number }).at + work.duration },
      fixed: false, priority: 1, days: [...work.days], paused: false, notify: true, kind: 'normal',
    });
    const want = [leg(COMMUTE_IN, 'Ida para o trabalho', 'before'), leg(COMMUTE_OUT, 'Volta para casa', 'after')];
    for (const w of want) {
      const cur = s.activities.find((a) => a.id === w.id);
      if (!cur) { s.activities.push(w); if (w.id === COMMUTE_IN) notes.push(`Deslocamento de ${commute} min incluído antes e depois do trabalho.`); }
      else if (cur.duration !== w.duration || JSON.stringify(cur.anchor) !== JSON.stringify(w.anchor) || cur.days.join() !== w.days.join()) {
        s.activities = s.activities.map((a) => (a.id === w.id ? { ...a, duration: w.duration, anchor: w.anchor, days: w.days } : a));
      }
    }
  }
  if (!work) return { state: s, notes };

  // Almoço do trabalho dentro do expediente.
  const lunch = linkWorkLunch(s);
  if (lunch.linked && !s.activities.find((a) => /almoco/.test(norm(a.title)))?.join) { s = lunch.state; notes.push(`Almoço junto com o Trabalho (${hm(s.profile.workLunch.at)}–${hm(s.profile.workLunch.at + s.profile.workLunch.duration)}).`); }
  else if (lunch.linked) s = lunch.state;

  // Manhã: acordar acompanha o trabalho.
  const start = (work.anchor as { at: number }).at;
  const prevWork = prev ? findWork(prev) : undefined;
  const prevStart = prevWork && prevWork.id === work.id && prevWork.anchor.type === 'time' ? prevWork.anchor.at : null;
  const types: ('weekday' | 'weekend')[] = [];
  if (work.days.some((d) => d >= 1 && d <= 5)) types.push('weekday');
  if (work.days.some((d) => d === 0 || d === 6)) types.push('weekend');
  for (const t of types) {
    const days = t === 'weekday' ? work.days.filter((d) => d >= 1 && d <= 5) : work.days.filter((d) => d === 0 || d === 6);
    const latest = latestWake(s, start, days);
    const w = s.sleep[t];
    // O deslocamento parte do estado ANTERIOR: rodar de novo não move em dobro.
    const from = prevStart !== null && prevStart !== start && prev ? prev.sleep[t] : w;
    let target = from === w ? w.wake : from.wake + (start - prevStart!);
    target = Math.min(target, latest);
    if (target < MIN_WAKE) {
      notes.push(`Para caber a manhã antes do trabalho às ${hm(start)} seria preciso acordar às ${hm(target)}. Mantive ${hm(w.wake)}: encurte a rotina da manhã ou o deslocamento.`);
      continue;
    }
    if (target !== w.wake) {
      const nw = moveWindow(from, target);
      notes.push(`${t === 'weekday' ? 'Dias de semana' : 'Fim de semana'}: acordar ${hm(w.wake)} → ${hm(nw.wake)} e dormir ${hm(w.bed)} → ${hm(nw.bed)} (mesmas horas de sono), para a rotina da manhã${s.profile.commuteMin ? ' e o deslocamento' : ''} caberem antes do trabalho às ${hm(start)}.`);
      s.sleep[t] = nw;
    }
  }

  // Trabalho mudado só em um dia: acordar daquele dia acompanha (também calculado a partir do estado anterior).
  for (const [date, o] of Object.entries(s.overrides)) {
    if (!(work.id in o.move)) continue;
    const dayStart = o.move[work.id];
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    const baseOf = (st: State) => (wd === 0 || wd === 6 ? st.sleep.weekend : st.sleep.weekday);
    const winOf = (st: State) => ({ wake: st.overrides[date]?.wake ?? baseOf(st).wake, bed: st.overrides[date]?.bed ?? baseOf(st).bed });
    const cur = winOf(s);
    const p0 = prev ?? s;
    const prevDay = p0.overrides[date]?.move[work.id];
    const prevStartBase = prevStart ?? start;
    let from = cur; let target = cur.wake;
    if (prevDay === undefined) { from = winOf(p0); target = from.wake + (dayStart - prevStartBase); }
    else if (prevDay !== dayStart) { from = winOf(p0); target = from.wake + (dayStart - prevDay); }
    target = Math.min(target, latestWake(s, dayStart, [wd]));
    if (target >= MIN_WAKE && target !== cur.wake) {
      const nw = moveWindow(from, target);
      s.overrides[date] = { ...(s.overrides[date] ?? emptyOverride()), wake: nw.wake, bed: nw.bed };
      notes.push(`Em ${date.slice(8, 10)}/${date.slice(5, 7)}: acordar às ${hm(nw.wake)} e dormir às ${hm(nw.bed)}, por causa do trabalho às ${hm(dayStart)}.`);
    }
  }
  return { state: s, notes };
}

/** Texto do horário de uma atividade (lista da rotina, IA). */
export function anchorLabel(a: Activity, all: Activity[]): string {
  if (a.kind === 'wake') return 'no horário de acordar';
  if (a.kind === 'bed') return 'no horário de dormir';
  const an = a.anchor;
  if (an.type === 'time') return `${a.fixed ? '' : 'perto de '}${hm(an.at)}–${hm(an.at + a.duration)}`;
  if (an.type === 'wake') return `${an.offset} min após acordar`;
  if (an.type === 'bed') return `${an.offset} min antes de dormir`;
  const names = an.ids.map((id) => all.find((x) => x.id === id)?.title).filter(Boolean).join(' ou ');
  return `${an.side === 'after' ? 'logo depois de' : 'logo antes de'} ${names || '—'}${an.gap ? ` (+${an.gap} min)` : ''}; nos outros dias perto de ${hm(an.fallback)}`;
}

/** Minuto usado para ordenar a lista da rotina. */
export function anchorSortKey(a: Activity, all: Activity[]): number {
  if (a.kind === 'wake') return -1;
  if (a.kind === 'bed') return 3000;
  const an = a.anchor;
  if (an.type === 'time') return an.at;
  if (an.type === 'wake') return an.offset;
  if (an.type === 'bed') return 2000 - an.offset;
  const p = all.find((x) => an.ids.includes(x.id) && x.anchor.type === 'time');
  return p && p.anchor.type === 'time' ? p.anchor.at + (an.side === 'after' ? p.duration + an.gap : -an.gap - a.duration) : an.fallback;
}
