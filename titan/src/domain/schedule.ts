import { addDays, weekday } from './dates';
import type { ProgramRow, SessionRow } from './types';

export interface NextSession { sequence: number; week: number; dayPos: number; finished: boolean }

/**
 * Agenda por sequência: sessões perdidas NÃO são duplicadas. O ciclo continua da próxima
 * sessão pendente e as datas seguintes são recalculadas a partir de hoje.
 */
export function nextSession(program: ProgramRow, sessions: SessionRow[]): NextSession {
  const perWeek = program.config.days.length;
  const total = perWeek * program.weeks;
  const closed = new Set(sessions.filter((s) => s.program_id === program.id && s.status !== 'in_progress').map((s) => s.sequence));
  let seq = 0;
  while (closed.has(seq) && seq < total) seq++;
  return { sequence: seq, week: Math.floor(seq / perWeek) + 1, dayPos: seq % perWeek, finished: seq >= total };
}

export function isTrainingDay(program: ProgramRow, iso: string): boolean {
  return program.config.trainingDays.includes(weekday(iso));
}

/** Projeta as próximas sessões em dias de treino a partir de `fromIso` (inclusive). */
export function projectSchedule(program: ProgramRow, sessions: SessionRow[], fromIso: string, count = 7) {
  const next = nextSession(program, sessions);
  const perWeek = program.config.days.length;
  const total = perWeek * program.weeks;
  const out: { date: string; sequence: number; week: number; dayPos: number }[] = [];
  let date = fromIso;
  let seq = next.sequence;
  let guard = 0;
  while (out.length < count && seq < total && guard++ < 400) {
    if (isTrainingDay(program, date)) {
      out.push({ date, sequence: seq, week: Math.floor(seq / perWeek) + 1, dayPos: seq % perWeek });
      seq++;
    }
    date = addDays(date, 1);
  }
  return out;
}

/** Data prevista para concluir o ciclo, considerando o ritmo de dias de treino. */
export function projectedEnd(program: ProgramRow, sessions: SessionRow[], fromIso: string): string | null {
  const all = projectSchedule(program, sessions, fromIso, 200);
  return all.length ? all[all.length - 1].date : null;
}

/** Sessões que deveriam ter ocorrido (pelo calendário original) e não foram feitas. */
export function missedCount(program: ProgramRow, sessions: SessionRow[], todayIso: string): number {
  let expected = 0;
  for (let d = program.start_date; d < todayIso; d = addDays(d, 1)) if (isTrainingDay(program, d)) expected++;
  const perWeek = program.config.days.length;
  expected = Math.min(expected, perWeek * program.weeks);
  const done = sessions.filter((s) => s.program_id === program.id && s.status === 'done').length;
  return Math.max(0, expected - done);
}
