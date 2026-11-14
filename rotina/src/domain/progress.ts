// Evolução estilo RPG: XP por atividade concluída, níveis, sequência, metas, conquistas e sono.
import { buildDay, type DayPlan, type PlanItem } from './scheduler';
import { addDays, weekDates } from './time';
import type { Completion, DayLog, State } from './types';

export const DAY_GOAL = 0.8;
export const WEEK_GOAL_DAYS = 5;
export const ACHIEVEMENT_XP = 50;

export const XP_BY_PRIORITY = { 1: 20, 2: 15, 3: 10 } as const;
export const ON_TIME_BONUS = 5;

/** No horário = concluído entre 30 min antes do início e 30 min depois do fim. */
export function xpFor(item: PlanItem, doneAtMin: number): { xp: number; onTime: boolean } {
  const onTime = doneAtMin >= item.start - 30 && doneAtMin <= item.end + 30;
  return { xp: XP_BY_PRIORITY[item.activity.priority] + (onTime ? ON_TIME_BONUS : 0), onTime };
}

/** Marca/desmarca concluído. Retorna um NOVO estado (com o registro do dia atualizado). */
export function toggleDone(state: State, date: string, item: PlanItem, now: Date, nowMinOfPlanDay: number): State {
  const s: State = structuredClone(state);
  const day = (s.completions[date] ??= {});
  if (day[item.activity.id]) delete day[item.activity.id];
  else {
    const { xp, onTime } = xpFor(item, nowMinOfPlanDay);
    day[item.activity.id] = { at: now.toISOString(), xp, onTime } satisfies Completion;
  }
  return syncDayLog(s, date);
}

/** Guarda quanto foi planejado e feito no dia (o histórico não muda se a rotina mudar depois). */
export function syncDayLog(state: State, date: string, plan: DayPlan = buildDay(state, date)): State {
  const done = state.completions[date] ?? {};
  const cats: DayLog['cats'] = {};
  let d = 0;
  for (const i of plan.items) {
    const c = (cats[i.activity.categoryId] ??= [0, 0]);
    c[0]++;
    if (done[i.activity.id]) { c[1]++; d++; }
  }
  const log: DayLog = { planned: plan.items.length, done: d, cats };
  const prev = state.dayLog[date];
  if (prev && prev.planned === log.planned && prev.done === log.done && JSON.stringify(prev.cats) === JSON.stringify(cats)) return state;
  return { ...state, dayLog: { ...state.dayLog, [date]: log } };
}

export const dayScore = (log?: DayLog) => (log && log.planned ? log.done / log.planned : 0);

export function totalXp(state: State): number {
  let xp = 0;
  for (const day of Object.values(state.completions)) for (const c of Object.values(day)) xp += c.xp;
  return xp + Object.keys(state.achievements).length * ACHIEVEMENT_XP;
}

/** Nível L começa em 50·L·(L−1) XP: 1→0, 2→100, 3→300, 4→600, 5→1000… */
export const xpForLevel = (l: number) => 50 * l * (l - 1);
export function levelInfo(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level); const to = xpForLevel(level + 1);
  return { level, title: levelTitle(level), into: xp - from, need: to - from, pct: (xp - from) / (to - from) };
}

const TITLES = ['Iniciante', 'Aprendiz', 'Focado', 'Disciplinado', 'Guerreiro', 'Veterano', 'Elite', 'Mestre', 'Lenda', 'Titã'];
export const levelTitle = (l: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 2))];

/** Dias seguidos com ≥ 80% (hoje conta se já bateu; se não, não quebra a sequência). */
export function streak(state: State, today: string): number {
  let n = 0;
  let d = dayScore(state.dayLog[today]) >= DAY_GOAL ? today : addDays(today, -1);
  while (dayScore(state.dayLog[d]) >= DAY_GOAL) { n++; d = addDays(d, -1); }
  return n;
}

export function bestStreak(state: State): number {
  const days = Object.keys(state.dayLog).sort();
  let best = 0; let cur = 0; let prev = '';
  for (const d of days) {
    if (dayScore(state.dayLog[d]) >= DAY_GOAL) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); }
    else cur = 0;
    prev = d;
  }
  return best;
}

export function weekProgress(state: State, today: string) {
  const days = weekDates(today);
  const hit = days.filter((d) => d <= today && dayScore(state.dayLog[d]) >= DAY_GOAL).length;
  return { hit, goal: WEEK_GOAL_DAYS, days: days.map((d) => ({ date: d, score: dayScore(state.dayLog[d]), future: d > today })) };
}

export function history(state: State, today: string, n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const log = state.dayLog[date];
    const xp = Object.values(state.completions[date] ?? {}).reduce((a, c) => a + c.xp, 0);
    return { date, score: dayScore(log), done: log?.done ?? 0, planned: log?.planned ?? 0, xp };
  });
}

/** Consistência por categoria nos últimos N dias (feito / planejado). */
export function categoryStats(state: State, today: string, n = 7) {
  const acc: Record<string, [number, number]> = {};
  for (let i = 0; i < n; i++) {
    const log = state.dayLog[addDays(today, -i)];
    if (!log) continue;
    for (const [c, [p, d]] of Object.entries(log.cats)) { const a = (acc[c] ??= [0, 0]); a[0] += p; a[1] += d; }
  }
  return state.categories.map((c) => ({ category: c, planned: acc[c.id]?.[0] ?? 0, done: acc[c.id]?.[1] ?? 0, rate: acc[c.id]?.[0] ? acc[c.id][1] / acc[c.id][0] : 0 }));
}

// ------------------------------------------------------------------ sono

const minOfDay = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };

/** Noites registradas: "Dormir" marcado na data D e "Acordar" marcado em D+1. */
export function sleepNights(state: State, today: string, n = 14) {
  const wakeId = state.activities.find((a) => a.kind === 'wake')?.id;
  const bedId = state.activities.find((a) => a.kind === 'bed')?.id;
  const out: { date: string; bedAt: number | null; wakeAt: number | null; minutes: number | null }[] = [];
  for (let i = n; i >= 1; i--) {
    const d = addDays(today, -i);
    const bed = bedId ? state.completions[d]?.[bedId] : undefined;
    const wake = wakeId ? state.completions[addDays(d, 1)]?.[wakeId] : undefined;
    const minutes = bed && wake ? Math.round((Date.parse(wake.at) - Date.parse(bed.at)) / 60000) : null;
    out.push({ date: d, bedAt: bed ? minOfDay(bed.at) : null, wakeAt: wake ? minOfDay(wake.at) : null, minutes: minutes !== null && minutes > 0 && minutes < 16 * 60 ? minutes : null });
  }
  return out;
}

const sd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

/** Regularidade 0–100 pelo desvio dos horários reais de acordar (7 dias). Precisa de 3 registros. */
export function sleepRegularity(state: State, today: string): { score: number | null; sdMin: number | null; avgSleep: number | null; nights: number } {
  const wakeId = state.activities.find((a) => a.kind === 'wake')?.id;
  const wakes: number[] = [];
  for (let i = 0; i < 7; i++) { const c = wakeId ? state.completions[addDays(today, -i)]?.[wakeId] : undefined; if (c) wakes.push(minOfDay(c.at)); }
  const nights = sleepNights(state, today, 7).filter((x) => x.minutes !== null);
  const avgSleep = nights.length ? Math.round(nights.reduce((a, x) => a + x.minutes!, 0) / nights.length) : null;
  if (wakes.length < 3) return { score: null, sdMin: null, avgSleep, nights: nights.length };
  const s = sd(wakes);
  return { score: Math.max(0, Math.round(100 - s * 1.5)), sdMin: Math.round(s), avgSleep, nights: nights.length };
}

// ------------------------------------------------------------------ conquistas

export interface Achievement { id: string; emoji: string; title: string; text: string; check: (s: State, today: string) => boolean }

const countDone = (s: State, pred?: (catId: string) => boolean) => {
  let n = 0;
  for (const day of Object.values(s.completions)) for (const id of Object.keys(day)) {
    const a = s.activities.find((x) => x.id === id);
    if (!pred || (a && pred(a.categoryId))) n++;
  }
  return n;
};
const xpNoBonus = (s: State) => Object.values(s.completions).reduce((a, d) => a + Object.values(d).reduce((b, c) => b + c.xp, 0), 0);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', emoji: '🎯', title: 'Primeiro passo', text: 'Concluir a primeira atividade.', check: (s) => countDone(s) >= 1 },
  { id: 'perfect', emoji: '💯', title: 'Dia perfeito', text: 'Concluir 100% da rotina de um dia.', check: (s) => Object.values(s.dayLog).some((l) => l.planned > 0 && l.done === l.planned) },
  { id: 'streak3', emoji: '🔥', title: 'Pegando ritmo', text: '3 dias seguidos com 80% ou mais.', check: (s) => bestStreak(s) >= 3 },
  { id: 'streak7', emoji: '⚡', title: 'Semana de ferro', text: '7 dias seguidos com 80% ou mais.', check: (s) => bestStreak(s) >= 7 },
  { id: 'streak30', emoji: '👑', title: 'Hábito formado', text: '30 dias seguidos com 80% ou mais.', check: (s) => bestStreak(s) >= 30 },
  { id: 'week', emoji: '📅', title: 'Meta semanal', text: `Bater a meta em ${WEEK_GOAL_DAYS} dias da mesma semana.`, check: (s, t) => weekProgress(s, t).hit >= WEEK_GOAL_DAYS },
  { id: 'xp500', emoji: '⭐', title: '500 XP', text: 'Somar 500 XP em atividades.', check: (s) => xpNoBonus(s) >= 500 },
  { id: 'xp2000', emoji: '🌟', title: '2.000 XP', text: 'Somar 2.000 XP em atividades.', check: (s) => xpNoBonus(s) >= 2000 },
  { id: 'body25', emoji: '💪', title: 'Corpo em construção', text: '25 atividades de BODY concluídas.', check: (s) => countDone(s, (c) => c === 'body') >= 25 },
  { id: 'face25', emoji: '✨', title: 'Pele em dia', text: '25 atividades de FACE concluídas.', check: (s) => countDone(s, (c) => c === 'face') >= 25 },
  { id: 'mind25', emoji: '🧠', title: 'Mente afiada', text: '25 atividades de MIND concluídas.', check: (s) => countDone(s, (c) => c === 'mind') >= 25 },
  { id: 'sleep7', emoji: '🌙', title: 'Relógio biológico', text: 'Regularidade do sono 80+ com 7 dias registrados.', check: (s, t) => { const r = sleepRegularity(s, t); return (r.score ?? 0) >= 80 && r.nights >= 5; } },
  { id: 'water7', emoji: '💧', title: 'Hidratado', text: 'Bater a meta de água 7 dias.', check: (s) => Object.values(s.water).filter((ml) => ml >= s.profile.waterMl).length >= 7 },
  { id: 'ai', emoji: '🤖', title: 'Rotina sob medida', text: 'Ajustar a rotina pelo "Descreva sua necessidade".', check: (s) => s.aiLog.some((x) => x.applied) },
];

/** Desbloqueia o que foi conquistado; retorna o estado novo e as novidades. */
export function unlockAchievements(state: State, today: string): { state: State; unlocked: Achievement[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && a.check(state, today));
  if (!unlocked.length) return { state, unlocked };
  const achievements = { ...state.achievements };
  for (const a of unlocked) achievements[a.id] = today;
  return { state: { ...state, achievements }, unlocked };
}
