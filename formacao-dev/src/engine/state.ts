// Estado do aluno e regras de aprendizagem (funções puras, testáveis).
import type { AreaId, Exercise } from '../data/types';

export interface ExState { attempts: number; correct: boolean; firstTry: boolean; hints: number; box: number; due: number; last: number; wrongCount: number }
export interface LessonState { status: 'started' | 'done'; step: number; startedAt: number; doneAt?: number; score?: number }
export interface Slot { id: number; weekday: number; hour: number; minute: number; title: string; body: string; enabled: boolean }
export interface AssessmentRun { score: number; total: number; date: number; wrong: string[] }

export interface AppState {
  version: 1;
  name: string;
  onboarded: boolean;
  startDate: string; // AAAA-MM-DD (um sábado)
  lessons: Record<string, LessonState>;
  exercises: Record<string, ExState>;
  sessions: Record<string, { blocks: string[]; done: boolean; doneAt?: number; note?: string }>;
  studyLog: Record<string, number>; // data → segundos estudados
  projects: Record<string, { steps: boolean[]; acceptance: boolean[]; done: boolean; url?: string }>;
  assessments: Record<string, AssessmentRun[]>;
  areaRatings: Partial<Record<AreaId, number>>;
  checklist: Record<string, boolean>;
  reminders: { enabled: boolean; slots: Slot[] };
  theme: 'auto' | 'dark' | 'light';
}

export const MSG_INICIO = 'Hora de estudar! Mais um passo para desenvolver suas habilidades e construir seu futuro na programação.';
export const MSG_CONTINUA = 'Continue firme! Pratique o que aprendeu e avance mais uma etapa da sua formação.';

/** Dias da semana no padrão do plugin de notificações: 1 = domingo … 7 = sábado. */
export const DEFAULT_SLOTS: Slot[] = [
  { id: 1001, weekday: 7, hour: 13, minute: 30, title: 'Sábado: início dos estudos', body: MSG_INICIO, enabled: true },
  { id: 1002, weekday: 7, hour: 15, minute: 15, title: 'Sábado: lembrete de continuidade', body: MSG_CONTINUA, enabled: true },
  { id: 1003, weekday: 1, hour: 13, minute: 30, title: 'Domingo: início dos estudos', body: MSG_INICIO, enabled: true },
  { id: 1004, weekday: 1, hour: 15, minute: 15, title: 'Domingo: lembrete de continuidade', body: MSG_CONTINUA, enabled: true },
];

export function ymd(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function parseYmd(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

/** Próximo sábado (ou hoje, se hoje for sábado). Se hoje for domingo, devolve o sábado de ontem. */
export function defaultStart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wd = d.getDay(); // 0 dom … 6 sáb
  if (wd === 0) d.setDate(d.getDate() - 1);
  else d.setDate(d.getDate() + (6 - wd));
  return ymd(d);
}

export function initialState(now = new Date()): AppState {
  return {
    version: 1, name: '', onboarded: false, startDate: defaultStart(now),
    lessons: {}, exercises: {}, sessions: {}, studyLog: {}, projects: {}, assessments: {},
    areaRatings: {}, checklist: {}, reminders: { enabled: true, slots: DEFAULT_SLOTS.map((s) => ({ ...s })) }, theme: 'auto',
  };
}

/** Garante que um estado salvo (ou importado de backup) tenha todos os campos. */
export function migrate(raw: unknown, now = new Date()): AppState {
  const base = initialState(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  const st: AppState = { ...base, ...r, version: 1 } as AppState;
  for (const k of ['lessons', 'exercises', 'sessions', 'studyLog', 'projects', 'assessments', 'areaRatings', 'checklist'] as const) {
    if (!st[k] || typeof st[k] !== 'object') (st as any)[k] = {};
  }
  if (!st.reminders || !Array.isArray(st.reminders.slots) || !st.reminders.slots.length) st.reminders = base.reminders;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(st.startDate)) st.startDate = base.startDate;
  return st;
}

// ───────────── Calendário de 12 semanas ─────────────

export interface CalendarPos { index: number; sessionN: number | null; isStudyDay: boolean; before: boolean; after: boolean; nextN: number; nextDate: Date; week: number }

/** Descobre qual sessão (1–24) corresponde à data, a partir do sábado de início. */
export function calendarPos(startDate: string, now = new Date()): CalendarPos {
  const start = parseYmd(startDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - start.getTime()) / 86400000);
  const week = Math.floor(days / 7); // 0-based
  const dow = ((days % 7) + 7) % 7; // 0 = sábado, 1 = domingo
  const before = days < 0;
  const isStudyDay = dow === 0 || dow === 1;
  let sessionN: number | null = null;
  if (!before && isStudyDay) sessionN = week * 2 + dow + 1;
  const after = !before && week >= 12;
  if (sessionN && sessionN > 24) sessionN = null;
  // próxima sessão a partir de amanhã (ou de hoje, se ainda antes do início)
  let nextN: number, nextDate: Date;
  if (before) { nextN = 1; nextDate = start; }
  else {
    const nextSat = new Date(start); nextSat.setDate(start.getDate() + (week + 1) * 7);
    if (dow === 0) { nextN = week * 2 + 2; nextDate = new Date(today); nextDate.setDate(today.getDate() + 1); }
    else { nextN = (week + 1) * 2 + 1; nextDate = nextSat; }
  }
  return { index: days, sessionN, isStudyDay, before, after, nextN: Math.min(nextN, 25), nextDate, week: week + 1 };
}

// ───────────── Revisão espaçada (Leitner) ─────────────

const DAY = 86400000;
/** Intervalos em dias para cada "caixa": acertos seguidos aumentam o intervalo. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 60];

export function recordAnswer(prev: ExState | undefined, correct: boolean, hintsUsed: number, now = Date.now()): ExState {
  const p: ExState = prev ?? { attempts: 0, correct: false, firstTry: false, hints: 0, box: 0, due: 0, last: 0, wrongCount: 0 };
  const attempts = p.attempts + 1;
  const firstTry = p.attempts === 0 && correct && hintsUsed === 0;
  let box = p.box;
  if (correct) box = Math.min(BOX_DAYS.length - 1, (hintsUsed > 0 ? Math.max(1, box) : box + 1));
  else box = 0;
  const due = correct ? now + BOX_DAYS[box] * DAY : now;
  return { attempts, correct: correct || p.correct, firstTry: p.attempts === 0 ? firstTry : p.firstTry, hints: p.hints + hintsUsed, box, due, last: now, wrongCount: p.wrongCount + (correct ? 0 : 1) };
}

/** Exercícios cuja revisão venceu, do mais atrasado para o mais recente. */
export function dueReviews(ex: Record<string, ExState>, now = Date.now(), limit = 10): string[] {
  return Object.entries(ex)
    .filter(([, s]) => s.due <= now && s.attempts > 0)
    .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
    .slice(0, limit)
    .map(([id]) => id);
}

// ───────────── Domínio por competência ─────────────

/** Nota de 0 a 1 para um exercício: acerto de primeira vale mais que acerto com dicas. */
export function exScore(s: ExState | undefined): number | null {
  if (!s || s.attempts === 0) return null;
  if (s.firstTry) return 1;
  if (!s.correct) return 0;
  const penalty = Math.min(0.5, 0.15 * s.hints + 0.1 * s.wrongCount);
  return Math.max(0.4, 0.85 - penalty) * (s.box >= 2 ? 1.1 : 1);
}

export interface Mastery { id: string; attempted: number; total: number; score: number }
export function masteryByCompetency(exercises: { ex: Exercise }[], st: Record<string, ExState>): Record<string, Mastery> {
  const m: Record<string, Mastery> = {};
  for (const { ex } of exercises) {
    const c = ex.competency;
    m[c] ??= { id: c, attempted: 0, total: 0, score: 0 };
    m[c].total++;
    const sc = exScore(st[ex.id]);
    if (sc !== null) { m[c].attempted++; m[c].score += Math.min(1, sc); }
  }
  for (const k in m) m[k].score = m[k].attempted ? m[k].score / m[k].attempted : 0;
  return m;
}

/** Competências com dificuldade: pelo menos 2 tentativas e domínio abaixo de 60%. */
export function weakPoints(m: Record<string, Mastery>): Mastery[] {
  return Object.values(m).filter((x) => x.attempted >= 2 && x.score < 0.6).sort((a, b) => a.score - b.score);
}

export function addStudy(log: Record<string, number>, seconds: number, now = new Date()) {
  const k = ymd(now);
  return { ...log, [k]: (log[k] ?? 0) + seconds };
}
