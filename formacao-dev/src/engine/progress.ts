// Cálculos de progresso e desempenho a partir do estado + conteúdo.
import { ALL_LESSONS, AREAS, COMPETENCIES, LESSONS, PROJECTS, TRACK_ORDER } from '../data';
import { SESSIONS } from '../data/schedule';
import type { AreaId, Exercise, Lesson } from '../data/types';
import { type AppState, masteryByCompetency, type Mastery, weakPoints } from './state';

export function lessonExercises(l: Lesson): Exercise[] { return [...l.exercises, ...(l.transfer ? [l.transfer] : [])]; }

export const ALL_EXERCISES: { ex: Exercise; lesson: string }[] = ALL_LESSONS.flatMap((l) => lessonExercises(l).map((ex) => ({ ex, lesson: l.id })));
export const EX_BY_ID: Record<string, { ex: Exercise; lesson: string }> = Object.fromEntries(ALL_EXERCISES.map((x) => [x.ex.id, x]));

/** Aulas obrigatórias = aulas listadas nas 24 sessões (sem as opcionais). */
export const REQUIRED_LESSONS: string[] = [...new Set(SESSIONS.flatMap((s) => s.lessons))];
export const REQUIRED_PROJECTS = ['p-landing', 'p-tarefas-cli', 'p-api-tarefas', 'p-api-postgres', 'p-final'];

export function mastery(st: AppState) { return masteryByCompetency(ALL_EXERCISES, st.exercises); }

export interface Overview {
  percent: number; lessonsDone: number; lessonsTotal: number; sessionsDone: number; projectsDone: number; projectsTotal: number;
  exercisesDone: number; exercisesCorrect: number; exercisesTotal: number; hours: number; assessmentsAvg: number | null;
  weak: Mastery[]; skills: Mastery[];
}

export function overview(st: AppState): Overview {
  const lessonsDone = REQUIRED_LESSONS.filter((id) => st.lessons[id]?.status === 'done').length;
  const projectsDone = REQUIRED_PROJECTS.filter((id) => st.projects[id]?.done).length;
  const sessionsDone = SESSIONS.filter((s) => st.sessions[s.id]?.done).length;
  const exs = Object.values(st.exercises);
  const best = [1, 2, 3].map((n) => Math.max(0, ...(st.assessments[String(n)] ?? []).map((a) => a.score / a.total)));
  const takenAss = [1, 2, 3].filter((n) => (st.assessments[String(n)] ?? []).length);
  const assessmentsAvg = takenAss.length ? takenAss.reduce((a, n) => a + best[n - 1], 0) / takenAss.length : null;
  // Fórmula transparente: 70% aulas obrigatórias, 20% projetos, 10% avaliações (melhor nota de cada).
  const percent = Math.round(100 * (0.7 * lessonsDone / REQUIRED_LESSONS.length + 0.2 * projectsDone / REQUIRED_PROJECTS.length + 0.1 * (best[0] + best[1] + best[2]) / 3));
  const m = mastery(st);
  return {
    percent, lessonsDone, lessonsTotal: REQUIRED_LESSONS.length, sessionsDone, projectsDone, projectsTotal: REQUIRED_PROJECTS.length,
    exercisesDone: exs.filter((e) => e.attempts > 0).length, exercisesCorrect: exs.filter((e) => e.correct).length, exercisesTotal: ALL_EXERCISES.length,
    hours: Object.values(st.studyLog).reduce((a, b) => a + b, 0) / 3600,
    assessmentsAvg, weak: weakPoints(m), skills: Object.values(m).filter((x) => x.attempted >= 3 && x.score >= 0.8),
  };
}

export interface AreaProgress { id: AreaId; done: number; total: number; percent: number; mastery: number | null }
export function areaProgress(st: AppState): AreaProgress[] {
  const m = mastery(st);
  return AREAS.map((a) => {
    const ls = TRACK_ORDER.filter((id) => LESSONS[id]?.area === a.id && !LESSONS[id].optional);
    const all = ls.length ? ls : TRACK_ORDER.filter((id) => LESSONS[id]?.area === a.id);
    const done = all.filter((id) => st.lessons[id]?.status === 'done').length;
    const comps = Object.values(m).filter((x) => COMPETENCIES[x.id]?.area === a.id && x.attempted > 0);
    const mast = comps.length ? comps.reduce((s, x) => s + x.score, 0) / comps.length : null;
    return { id: a.id, done, total: all.length, percent: all.length ? Math.round((100 * done) / all.length) : 0, mastery: mast };
  });
}

/** Sugestão de direção profissional: combina desempenho (domínio) e gosto (nota 1–5 dada pelo aluno). */
export function directionSuggestion(st: AppState) {
  const ap = areaProgress(st).filter((a) => !['fund', 'ferramentas', 'carreira'].includes(a.id));
  const scored = ap.map((a) => {
    const like = st.areaRatings[a.id] ?? 3;
    const perf = a.mastery ?? 0.5;
    const bonus = a.id === 'back' ? 0.1 : 0; // foco declarado do aluno
    return { id: a.id, score: 0.5 * (like / 5) + 0.4 * perf + bonus, like, perf: a.mastery };
  }).sort((x, y) => y.score - x.score);
  return scored;
}

export function weekMinutes(st: AppState, now = new Date()) {
  const out: { label: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out.push({ label: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.getDay()], minutes: Math.round((st.studyLog[k] ?? 0) / 60) });
  }
  return out;
}

/** Monta uma avaliação mensal (perguntas objetivas das aulas do mês), com sorteio estável por semente. */
export function buildAssessment(month: 1 | 2 | 3, seed: number, size = 15): Exercise[] {
  const lessons = month === 3 ? REQUIRED_LESSONS : SESSIONS.filter((s) => s.month === month).flatMap((s) => s.lessons);
  const pool = lessons.flatMap((id) => (LESSONS[id] ? lessonExercises(LESSONS[id]) : [])).filter((e) => e.type === 'mcq' || (e.type === 'predict' && (e.lang ?? 'js') === 'js'));
  let x = seed || 1;
  const rand = () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  const shuffled = [...pool].sort(() => rand() - 0.5);
  // equilibra: no máximo 2 perguntas por aula
  const per: Record<string, number> = {};
  const out: Exercise[] = [];
  for (const e of shuffled) {
    const l = EX_BY_ID[e.id]?.lesson ?? '';
    if ((per[l] ?? 0) >= 2) continue;
    per[l] = (per[l] ?? 0) + 1; out.push(e);
    if (out.length >= (month === 3 ? 25 : size)) break;
  }
  return out;
}

/** Relatório honesto de preparação profissional. */
export function readiness(st: AppState) {
  const o = overview(st);
  const m = mastery(st);
  const core = ['functions', 'data-structures', 'http', 'rest-crud', 'db-basics', 'sql-practice', 'auth', 'input-security', 'testing', 'git-basics'];
  const coreScores = core.map((c) => ({ id: c, name: COMPETENCIES[c]?.name ?? c, score: m[c]?.attempted ? m[c].score : null }));
  const coreAvg = coreScores.filter((c) => c.score !== null).reduce((a, c) => a + (c.score ?? 0), 0) / Math.max(1, coreScores.filter((c) => c.score !== null).length);
  const finalDone = !!st.projects['p-final']?.done;
  const checklistDone = Object.values(st.checklist).filter(Boolean).length;
  let level: string; let text: string;
  if (o.percent < 30) { level = 'Começando'; text = 'Você está construindo a base. Foque em constância: siga as sessões de sábado e domingo.'; }
  else if (o.percent < 60) { level = 'Base em construção'; text = 'Você já entende os fundamentos. Continue praticando e comece os projetos de API.'; }
  else if (o.percent < 85 || !finalDone) { level = 'Iniciante com base sólida'; text = 'Você já constrói programas e APIs. Terminar e publicar o projeto final é o passo que mais aumenta suas chances.'; }
  else if (coreAvg >= 0.75 && checklistDone >= 7) { level = 'Pronto para começar a disputar vagas de estágio/júnior'; text = 'Você tem base, portfólio e preparação. Candidate-se com constância enquanto aprofunda (veja o plano dos próximos meses). Lembre: a primeira vaga costuma exigir persistência.'; }
  else { level = 'Quase pronto para candidaturas'; text = 'Reforce as competências essenciais abaixo de 75% e complete o checklist de carreira antes de intensificar as candidaturas.'; }
  return { level, text, coreScores, coreAvg, finalDone, checklistDone, overview: o };
}

export { PROJECTS };
