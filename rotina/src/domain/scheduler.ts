// Monta o dia: acordar e dormir primeiro, depois os blocos fixos, depois os flexíveis por prioridade,
// cada um no espaço livre mais próximo do horário preferido. Nunca gera dois blocos no mesmo horário.
import { isWeekend, weekday } from './time';
import type { Activity, DayOverride, SleepWindow, State } from './types';

export interface PlanItem {
  activity: Activity;
  start: number;
  end: number;
  /** Onde ele queria ficar (para explicar mudanças). */
  preferred: number;
  fixed: boolean;
  /** Só neste dia (adicionado ou movido para hoje). */
  todayOnly: boolean;
  /** Acontece dentro desta atividade (não ocupa horário próprio). */
  parentId?: string;
}

export interface DayPlan {
  date: string;
  wake: number;
  /** Pode passar de 1440 (dormir depois da meia-noite). */
  bed: number;
  sleepMinutes: number;
  items: PlanItem[];
  /** Não couberam no dia (com o motivo). */
  unplaced: { activity: Activity; reason: string }[];
  skipped: Activity[];
  conflicts: string[];
}

/** Normaliza bed para ficar depois de wake (00:30 → 24:30). */
export function normBed(w: SleepWindow): number {
  return w.bed <= w.wake ? w.bed + 1440 : w.bed;
}

/** Sono da noite que COMEÇA neste horário de dormir até o próximo acordar. */
export function sleepMinutes(bed: number, nextWake: number): number {
  const b = bed % 1440;
  let m = nextWake + 1440 - b;
  if (m > 1440) m -= 1440;
  return m;
}

export function windowFor(state: State, date: string): SleepWindow {
  const base = isWeekend(date) ? state.sleep.weekend : state.sleep.weekday;
  const o = state.overrides[date];
  return { wake: o?.wake ?? base.wake, bed: o?.bed ?? base.bed };
}

export function activitiesFor(state: State, date: string): { list: Activity[]; skipped: Activity[]; override?: DayOverride } {
  const wd = weekday(date);
  const o = state.overrides[date];
  const base = state.activities.filter((a) => !a.paused && a.days.includes(wd));
  const extra = (o?.add ?? []).filter((a) => !a.paused);
  const all = [...base, ...extra];
  const skip = new Set(o?.skip ?? []);
  return { list: all.filter((a) => !skip.has(a.id)), skipped: all.filter((a) => skip.has(a.id)), override: o };
}

function preferredStart(a: Activity, wake: number, bed: number): number {
  if (a.anchor.type === 'time') {
    // Horário do relógio antes de acordar = madrugada do dia seguinte (ex.: 00:30 com dormir à 01:00).
    return a.anchor.at < wake && a.anchor.at + 1440 < bed ? a.anchor.at + 1440 : a.anchor.at;
  }
  if (a.anchor.type === 'wake') return wake + a.anchor.offset;
  return bed - a.anchor.offset;
}

type Busy = [number, number];
const overlaps = (a: Busy, b: Busy) => a[0] < b[1] && b[0] < a[1];

function freeSlots(busy: Busy[], from: number, to: number): Busy[] {
  const sorted = [...busy].sort((x, y) => x[0] - y[0]);
  const out: Busy[] = [];
  let cur = from;
  for (const [s, e] of sorted) {
    if (e <= cur) continue;
    if (s > cur) out.push([cur, Math.min(s, to)]);
    cur = Math.max(cur, e);
    if (cur >= to) break;
  }
  if (cur < to) out.push([cur, to]);
  return out.filter(([s, e]) => e > s);
}

export function buildDay(state: State, date: string): DayPlan {
  const win = windowFor(state, date);
  const wake = win.wake;
  const bed = normBed(win);
  const { list, skipped, override } = activitiesFor(state, date);
  const nextWin = windowFor(state, nextDate(date));
  const items: PlanItem[] = [];
  const unplaced: DayPlan['unplaced'] = [];
  const conflicts: string[] = [];
  const busy: Busy[] = [];

  const dur = (a: Activity) => override?.duration[a.id] ?? a.duration;
  const todayOnly = (a: Activity) => !!override && (override.add.some((x) => x.id === a.id) || a.id in override.move || a.id in override.duration);

  // 1) Acordar e dormir (ancorados no sono).
  for (const a of list.filter((x) => x.kind === 'wake' || x.kind === 'bed')) {
    const start = a.kind === 'wake' ? wake : bed;
    const end = a.kind === 'wake' ? wake + dur(a) : bed;
    items.push({ activity: a, start, end, preferred: start, fixed: true, todayOnly: false });
    if (end > start) busy.push([start, end]);
  }

  // Atividades "junto com": se a mãe acontece hoje, são encaixadas dentro dela no fim (não ocupam horário).
  const present = new Set(list.map((a) => a.id));
  const joined = list.filter((a) => a.join && a.join.parentId !== a.id && present.has(a.join.parentId) && !list.find((p) => p.id === a.join!.parentId)?.join);
  const joinedIds = new Set(joined.map((a) => a.id));
  const normal = list.filter((x) => x.kind !== 'wake' && x.kind !== 'bed' && !joinedIds.has(x.id));
  const isFixed = (a: Activity) => a.fixed || a.id in (override?.move ?? {});
  const pref = (a: Activity) => override?.move[a.id] ?? preferredStart(a, wake, bed);

  // 2) Fixos, na ordem do horário. Se dois fixos batem, o segundo começa quando o primeiro termina.
  const fixedList = normal.filter(isFixed).sort((a, b) => pref(a) - pref(b) || a.priority - b.priority);
  for (const a of fixedList) {
    let start = pref(a);
    const d = dur(a);
    const clash = busy.filter((b) => overlaps(b, [start, start + d])).sort((x, y) => y[1] - x[1])[0];
    if (clash) {
      conflicts.push(`${a.title} batia com outro horário fixo e foi para logo depois.`);
      start = clash[1];
    }
    if (start < wake || start + d > bed) {
      unplaced.push({ activity: a, reason: start < wake ? 'antes do horário de acordar' : 'depois do horário de dormir' });
      continue;
    }
    items.push({ activity: a, start, end: start + d, preferred: pref(a), fixed: true, todayOnly: todayOnly(a) });
    busy.push([start, start + d]);
  }

  // 3) Flexíveis: essenciais primeiro, depois importantes, depois flexíveis; dentro de cada, pelo horário.
  const flex = normal.filter((a) => !isFixed(a)).sort((a, b) => a.priority - b.priority || pref(a) - pref(b));
  for (const a of flex) {
    const d = dur(a);
    const p = Math.max(wake, Math.min(pref(a), bed - d));
    let best: number | null = null;
    for (const [s, e] of freeSlots(busy, wake, bed)) {
      if (e - s < d) continue;
      const cand = Math.max(s, Math.min(p, e - d));
      if (best === null || Math.abs(cand - p) < Math.abs(best - p) || (Math.abs(cand - p) === Math.abs(best - p) && cand < best)) best = cand;
    }
    if (best === null) { unplaced.push({ activity: a, reason: 'não há espaço livre suficiente entre acordar e dormir' }); continue; }
    items.push({ activity: a, start: best, end: best + d, preferred: pref(a), fixed: false, todayOnly: todayOnly(a) });
    busy.push([best, best + d]);
  }

  // 4) Dentro da atividade-mãe.
  for (const a of joined) {
    const parent = items.find((i) => i.activity.id === a.join!.parentId);
    if (!parent) { unplaced.push({ activity: a, reason: `${list.find((p) => p.id === a.join!.parentId)?.title ?? 'a atividade'} não coube hoje` }); continue; }
    const d = Math.min(override?.duration[a.id] ?? a.join!.duration, parent.end - parent.start);
    // Horário escolhido; se a mãe foi movida neste dia, acompanha o deslocamento.
    const moved = override?.move[a.id];
    let start = moved ?? a.join!.at + (parent.start - parent.preferred);
    start = Math.max(parent.start, Math.min(start, parent.end - d));
    items.push({ activity: a, start, end: start + d, preferred: a.join!.at, fixed: true, todayOnly: todayOnly(a), parentId: parent.activity.id });
  }

  items.sort((a, b) => a.start - b.start || (a.activity.kind === 'bed' ? 1 : 0) - (b.activity.kind === 'bed' ? 1 : 0));
  return { date, wake, bed, sleepMinutes: sleepMinutes(bed, nextWin.wake), items, unplaced, skipped, conflicts };
}

function nextDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

/** Item atual e próximo para um horário (minutos). */
export function currentAndNext(plan: DayPlan, nowMin: number, done: Set<string>) {
  // Com atividades "junto", a de dentro (que começou depois) é a atual.
  const current = [...plan.items].reverse().find((i) => i.start <= nowMin && nowMin < i.end) ?? null;
  const next = plan.items.find((i) => i.start > nowMin && !done.has(i.activity.id)) ?? null;
  return { current, next };
}

/** Atrasado = já começou há mais de X min e não foi concluído (ignora "Dormir"). */
export function isLate(item: PlanItem, nowMin: number, done: boolean, lateAfter = 15) {
  return !done && item.activity.kind !== 'bed' && nowMin > item.start + lateAfter;
}
