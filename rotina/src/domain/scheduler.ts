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
  /** Duração original quando foi encurtada para caber. */
  shortenedFrom?: number;
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
  /** Opcionais que não couberam hoje (sem aviso). */
  optionalOut: Activity[];
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
  if (a.anchor.type === 'rel') return a.anchor.fallback < wake && a.anchor.fallback + 1440 < bed ? a.anchor.fallback + 1440 : a.anchor.fallback;
  return bed - a.anchor.offset;
}

const normTitle = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

/**
 * Horário de dormir do dia: o do próprio tipo de dia, mas cedo o bastante para ter a meta mínima de sono
 * (8 h) até o horário de acordar do dia seguinte (ex.: domingo antes de uma segunda em que você acorda cedo).
 * Ajuste "só hoje" manda.
 */
export function bedFor(state: State, date: string): number {
  const win = windowFor(state, date);
  const own = normBed(win);
  if (state.overrides[date]?.bed !== undefined) return own;
  const next = windowFor(state, nextDate(date));
  if (next.wake === win.wake && next.bed === win.bed) return own; // mesmo horário amanhã: vale o que você escolheu
  const latest = next.wake + 1440 - state.sleep.goalMin; // minutos deste dia
  return Math.max(win.wake + 60, Math.min(own, latest));
}

/**
 * Monta o dia. Primeiro no jeito natural (cada coisa perto do horário dela). Se alguma prioridade máxima
 * ficar de fora (ex.: o jantar espremido depois da academia), monta de novo com as refeições primeiro e fica
 * com o que encaixar mais prioridades máximas.
 */
export function buildDay(state: State, date: string): DayPlan {
  const a = buildDayWith(state, date, false);
  const topOut = (p: DayPlan) => p.unplaced.filter((u) => u.activity.priority === 0).length;
  if (!topOut(a)) return a;
  const b = buildDayWith(state, date, true);
  return topOut(b) < topOut(a) ? b : a;
}

function buildDayWith(state: State, date: string, mealsFirst: boolean): DayPlan {
  const win = windowFor(state, date);
  const wake = win.wake;
  const bed = bedFor(state, date);
  const { list: list0, skipped, override } = activitiesFor(state, date);
  // Dia de foco (ex.: dia de estudo): a atividade vira prioridade máxima e deixa de ser opcional só neste dia.
  const wdToday = weekday(date);
  const promoted = new Set<string>();
  const list = list0.map((a) => { if (!a.focusDays?.includes(wdToday)) return a; promoted.add(a.id); return { ...a, priority: 0 as const, optional: false }; });
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
  // Busca restrita a [lo, hi]: janelas das refeições (maxShift) e "só depois de" das encadeadas.
  const nearest = (p: number, d: number, lo: number, hi: number): number | null => {
    let best: number | null = null;
    for (const [s0, e0] of freeSlots(busy, wake, bed)) {
      const s = Math.max(s0, lo); const e = Math.min(e0, hi);
      if (e - s < d) continue;
      const cand = Math.max(s, Math.min(p, e - d));
      if (best === null || Math.abs(cand - p) < Math.abs(best - p) || (Math.abs(cand - p) === Math.abs(best - p) && cand < best)) best = cand;
    }
    return best;
  };
  /** Maior espaço livre ≥ mínimo: devolve início e duração (encurtada, múltiplo de 5). */
  const largest = (p: number, d: number, min: number, lo: number, hi: number): { start: number; d: number } | null => {
    let best: { start: number; d: number } | null = null;
    for (const [s0, e0] of freeSlots(busy, wake, bed)) {
      const s = Math.max(s0, lo); const e = Math.min(e0, hi);
      const dd = Math.min(d, Math.floor((e - s) / 5) * 5);
      if (dd < min) continue;
      const start = Math.max(s, Math.min(p, e - dd));
      if (!best || dd > best.d || (dd === best.d && Math.abs(start - p) < Math.abs(best.start - p))) best = { start, d: dd };
    }
    return best;
  };
  const place = (a: Activity, prefOverride?: number, bounds?: { lo?: number; hi?: number }): boolean => {
    const d = dur(a);
    const p = Math.max(wake, Math.min(prefOverride ?? pref(a), bed - d));
    let lo = bounds?.lo ?? -Infinity; let hi = bounds?.hi ?? Infinity;
    // Refeição (ou outra com maxShift) não vai para longe do horário dela: jantar não vira café da manhã.
    if (a.maxShift !== undefined) { const base = prefOverride ?? pref(a); lo = Math.max(lo, base - a.maxShift); hi = Math.min(hi, base + a.maxShift + d); }
    const at = nearest(p, d, lo, hi);
    if (at !== null) { items.push({ activity: a, start: at, end: at + d, preferred: pref(a), fixed: false, todayOnly: todayOnly(a) }); busy.push([at, at + d]); return true; }
    const min = a.minDuration && a.minDuration < d ? a.minDuration : null;
    const sh = min ? largest(p, d, min, lo, hi) : null;
    if (!sh) return false;
    items.push({ activity: a, start: sh.start, end: sh.start + sh.d, preferred: pref(a), fixed: false, todayOnly: todayOnly(a), shortenedFrom: d });
    busy.push([sh.start, sh.start + sh.d]);
    return true;
  };
  // Opcional fica logo depois da sua prioridade (ex.: estudos opcionais depois das refeições/treino,
  // mas antes do lazer). Se nem a duração mínima couber, fica de fora sem aviso.
  // Dentro da mesma prioridade: refeições (têm janela de horário) primeiro, depois o resto, depois o que só
  // subiu de prioridade no dia (dia de estudo); opcionais por último.
  const rank = (a: Activity) => a.priority + (mealsFirst && a.maxShift !== undefined ? -0.1 : 0) + (promoted.has(a.id) ? 0.3 : 0) + (a.optional ? 0.5 : 0);
  const optionalOut: Activity[] = [];
  const fail = (a: Activity) => {
    if (a.optional) optionalOut.push(a);
    else unplaced.push({ activity: a, reason: 'não há espaço livre suficiente entre acordar e dormir' });
  };
  // Encadeadas ("logo depois de…"): a mãe é a primeira da lista que acontece no dia.
  // Cada uma entra na vez da SUA prioridade (o lanche pós-treino não passa na frente do jantar);
  // se a mãe ainda não foi encaixada, espera por ela e entra logo em seguida.
  const relParent = (a: Activity) => (a.anchor.type === 'rel' ? a.anchor.ids.find((id) => id !== a.id && present.has(id) && !joinedIds.has(id)) : undefined);
  const placedIds = () => new Set(items.map((i) => i.activity.id));
  const waiting = new Map<string, Activity[]>(); // mãe → filhas esperando
  const placeRel = (a: Activity): boolean => {
    const parent = items.find((i) => i.activity.id === relParent(a));
    if (!parent) return place(a); // mãe não está no dia/ não coube: horário próprio
    const an = a.anchor as Extract<Activity['anchor'], { type: 'rel' }>;
    const p = an.side === 'after' ? parent.end + an.gap : parent.start - an.gap - dur(a);
    // "Logo depois" nunca vai para antes da mãe (banho não antes da academia).
    return place(a, p, an.side === 'after' ? { lo: parent.end } : { hi: parent.start });
  };
  const flex = normal.filter((a) => !isFixed(a)).sort((a, b) => rank(a) - rank(b) || pref(a) - pref(b));
  const done = new Set<string>();
  /** Filhas essenciais (deslocamento, banho) grudam na hora em que a mãe é encaixada. */
  const glueNow = (parentId: string) => {
    for (const c of flex.filter((x) => !done.has(x.id) && relParent(x) === parentId && x.priority <= 1)) placeOne(c);
  };
  function placeOne(a: Activity) {
    done.add(a.id);
    // Lanche pós-treino é dispensável quando o jantar já vem até 1h30 depois do treino: o jantar é a refeição pós-treino.
    if (/pos-treino/.test(normTitle(a.title))) {
      const parent = items.find((i) => i.activity.id === relParent(a));
      // jantar já encaixado, ou jantar "junto com" o trabalho (entra depois, mas o horário já é conhecido)
      const placedDinner = items.find((i) => /^jantar/.test(normTitle(i.activity.title)));
      const joinedDinner = joined.find((x) => /^jantar/.test(normTitle(x.title)));
      const dinnerParent = joinedDinner ? items.find((i) => i.activity.id === joinedDinner.join!.parentId) : undefined;
      const dinner = placedDinner ?? (joinedDinner && dinnerParent ? { start: joinedDinner.join!.at + (dinnerParent.start - dinnerParent.preferred) } : undefined);
      if (parent && dinner && dinner.start >= parent.end && dinner.start - parent.end <= 90) { optionalOut.push(a); return; }
      // só entre o treino e o jantar; se não couber ali, sai do dia (comer depois do jantar não faz sentido)
      if (parent && dinner && dinner.start >= parent.end) {
        const an = a.anchor as Extract<Activity['anchor'], { type: 'rel' }>;
        if (!place(a, parent.end + an.gap, { lo: parent.end, hi: dinner.start })) optionalOut.push(a);
        return;
      }
    }
    const ok = relParent(a) ? placeRel(a) : place(a);
    if (!ok) { fail(a); return; }
    glueNow(a.id);
    for (const c of waiting.get(a.id) ?? []) if (!done.has(c.id)) placeOne(c);
    waiting.delete(a.id);
  }
  // mães já encaixadas (fixas, como o Trabalho): deslocamento gruda antes de tudo
  for (const it of [...items]) glueNow(it.activity.id);
  const willPlace = new Set(flex.map((a) => a.id));
  for (const a of flex) {
    if (done.has(a.id)) continue;
    const parentId = relParent(a);
    if (parentId && willPlace.has(parentId) && !placedIds().has(parentId) && !unplaced.some((u) => u.activity.id === parentId) && !optionalOut.some((o) => o.id === parentId)) {
      waiting.set(parentId, [...(waiting.get(parentId) ?? []), a]);
      continue;
    }
    placeOne(a);
  }
  // mãe não coube: as filhas usam o horário próprio
  for (const kids of waiting.values()) for (const c of kids) { if (done.has(c.id)) continue; done.add(c.id); if (place(c)) continue; fail(c); }

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
  return { date, wake, bed, sleepMinutes: sleepMinutes(bed, nextWin.wake), items, unplaced, skipped, conflicts, optionalOut };
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
